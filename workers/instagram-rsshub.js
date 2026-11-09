// Staged replacement: publish only after the hosted RSSHub feed passes validation.
const SNAPSHOT = 'instagram:snapshot';
const MAX_BYTES = 5 * 1024 * 1024;
const INTERVAL = 6 * 60 * 60 * 1000;

function decode(value = '') {
  return String(value).replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export function mediaUrl(value) {
  try {
    const url = new URL(decode(value));
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (!['cdninstagram.com', 'fbcdn.net', 'instagram.com'].some(host =>
      url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
    return url.href;
  } catch { return null; }
}

export function normalize(data) {
  if (!Array.isArray(data?.items) || !data.version?.startsWith('https://jsonfeed.org/')) {
    throw new Error('RSSHub did not return JSON Feed');
  }
  const posts = data.items.map(item => {
    const html = item.content_html || '';
    const image = item.image || html.match(/<video\b[^>]*\bposter=["']([^"']+)/i)?.[1]
      || html.match(/<img\b[^>]*\bsrc=["']([^"']+)/i)?.[1]
      || item.attachments?.find(file => file.mime_type?.startsWith('image/'))?.url;
    let permalink;
    try {
      const url = new URL(item.url);
      if (url.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(url.hostname)
        && /^\/(p|reel)\/[\w-]+\/?$/.test(url.pathname)) permalink = url.href;
    } catch { /* Invalid feed items must not become clickable links. */ }
    return {
      id: String(item.id || item.url),
      permalink,
      caption: decode(String(item.summary || item.content_text || item.title || 'View this post on Instagram').replace(/<[^>]*>/g, ' ')),
      timestamp: Number.isFinite(Date.parse(item.date_published)) ? new Date(item.date_published).toISOString() : '',
      media_type: 'IMAGE',
      source_image: mediaUrl(image)
    };
  }).filter(post => post.permalink && post.source_image);
  // Pinned posts can arrive before newer posts. Prefer dates where available.
  posts.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  if (!posts.length) throw new Error('No usable Instagram posts');
  return { posts: posts.slice(0, 3), avatar: mediaUrl(data.icon || data.favicon) };
}

async function bounded(response) {
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Upstream response too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function saveImage(source, env) {
  const response = await fetch(source, {
    redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Referer: 'https://www.instagram.com/', Accept: 'image/*' }
  });
  const type = response.headers.get('content-type')?.split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(type)) {
    throw new Error('Invalid image response');
  }
  const bytes = await bounded(response);
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  // Content-addressed images never expire with Instagram's signed URLs.
  if (!await env.INSTAGRAM_STATE.get(`image:${hash}`, 'arrayBuffer')) {
    await env.INSTAGRAM_STATE.put(`image:${hash}`, bytes.buffer, { metadata: { type } });
  }
  return hash;
}

export async function refresh(env) {
  if (!env.INSTAGRAM_STATE || !env.RSSHUB_FEED_URL) throw new Error('RSSHub configuration missing');
  const url = new URL(env.RSSHUB_FEED_URL);
  if (url.protocol !== 'https:' || url.hostname === 'rsshub.app') throw new Error('Use a self-hosted HTTPS RSSHub endpoint');
  url.searchParams.set('format', 'json');
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Accept: 'application/feed+json, application/json' } });
  const feed = normalize(JSON.parse(new TextDecoder().decode(await bounded(response))));
  const previous = await env.INSTAGRAM_STATE.get(SNAPSHOT, 'json');
  const posts = [];
  for (const { source_image, ...post } of feed.posts) {
    posts.push({ ...post, image: await saveImage(source_image, env) });
  }
  let avatar = previous?.avatar || null;
  if (feed.avatar) {
    try { avatar = await saveImage(feed.avatar, env); }
    catch { console.warn('instagram_avatar_refresh_failed'); }
  }
  const snapshot = { posts, avatar, updated_at: new Date().toISOString(), source: 'rsshub' };
  // Commit only after all post images are saved. Failures leave the old snapshot intact.
  await env.INSTAGRAM_STATE.put(SNAPSHOT, JSON.stringify(snapshot));
  return snapshot;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refresh(env).catch(error => {
      console.error(JSON.stringify({ event: 'instagram_refresh_failed', message: error.message }));
      throw error;
    }));
  },
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {
      'Access-Control-Allow-Origin': ['https://firelandsunited.com', 'https://www.firelandsunited.com'].includes(origin) ? origin : 'https://firelandsunited.com',
      'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers });
    if (!env.INSTAGRAM_STATE) return Response.json({ error: 'Feed storage not configured' }, { status: 503, headers });
    const url = new URL(request.url);
    const asset = url.searchParams.get('asset');
    if (asset) {
      if (!/^[a-f0-9]{64}$/.test(asset)) return new Response('Invalid asset', { status: 400, headers });
      const saved = await env.INSTAGRAM_STATE.getWithMetadata(`image:${asset}`, 'arrayBuffer');
      if (!saved.value) return new Response('Image not found', { status: 404, headers });
      return new Response(saved.value, { headers: { ...headers, 'Content-Type': saved.metadata.type, 'Cache-Control': 'public, max-age=86400, immutable' } });
    }
    // Visitors never trigger Instagram requests or public force-refreshes.
    const snapshot = await env.INSTAGRAM_STATE.get(SNAPSHOT, 'json');
    if (!snapshot) return Response.json({ error: 'Feed awaiting first successful refresh' }, { status: 503, headers });
    const imageUrl = hash => {
      const target = new URL(request.url); target.search = ''; target.searchParams.set('asset', hash); return target.href;
    };
    const requested = Number(url.searchParams.get('limit') || 1);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(3, Math.floor(requested))) : 1;
    return Response.json({
      posts: snapshot.posts.slice(0, limit).map(({ image, ...post }) => ({ ...post, image_url: imageUrl(image) })),
      profile: { username: 'firelandsunited', profile_picture_url: snapshot.avatar ? imageUrl(snapshot.avatar) : 'https://firelandsunited.com/img/firelands-badge.png' },
      updated_at: snapshot.updated_at, source: 'rsshub', stale: Date.now() - Date.parse(snapshot.updated_at) > INTERVAL * 2
    }, { headers: { ...headers, 'Cache-Control': 'public, max-age=300' } });
  }
};
