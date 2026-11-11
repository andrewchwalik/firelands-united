const API = 'https://api.apify.com/v2';
const ACTOR = 'shu8hvrXbJbY3Eb9W';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
export function newest(posts) {
  return posts.filter(p => /^[\w-]+$/.test(p.shortCode || '') && Number.isFinite(Date.parse(p.timestamp)) &&
    (p.ownerUsername === 'firelandsunited' || p.coauthorProducers?.some(a => a.username === 'firelandsunited')))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
}
async function api(env, path) {
  const r = await fetch(API + path, { method: 'GET', headers: { Authorization: `Bearer ${env.APIFY_TOKEN}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(70000) });
  if (!r.ok) throw new Error(`Apify HTTP ${r.status}`);
  return r.json();
}
async function media(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(u.hostname)) throw new Error('Unexpected media host');
  const r = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const type = (r.headers.get('content-type') || '').split(';')[0];
  if (!r.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Invalid image response');
  const reader = r.body.getReader(); const parts = []; let length = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 5 * 1024 * 1024) { await reader.cancel(); throw new Error('Image exceeds cache limit'); } parts.push(value); }
  const data = new Uint8Array(length); let offset = 0; for (const p of parts) { data.set(p, offset); offset += p.length; }
  const valid = type === 'image/jpeg' ? data[0] === 255 && data[1] === 216 : type === 'image/png' ? data[0] === 137 && data[1] === 80 : new TextDecoder().decode(data.slice(8,12)) === 'WEBP';
  if (!valid) throw new Error('Invalid image signature');
  return { data, type };
}
export async function refresh(env, now = new Date()) {
  let state = await env.CACHE.get('state', 'json') || {};
  const checked = await env.CACHE.get('checkedAt');
  if (checked && now.getTime() - Number(checked) < 15 * 60000) return;
  if (!env.APIFY_TOKEN) throw new Error('Missing scraper secret');
  await env.CACHE.put('checkedAt', String(now.getTime()));
  state = { ...state, attemptedAt: now.toISOString() };
  try {
    const { data } = await api(env, `/acts/${ACTOR}/runs?limit=1&desc=true&status=SUCCEEDED`);
    const run = data.items?.[0];
    if (!run) throw new Error('No completed scraper run');
    const previous = await env.CACHE.get('feed', 'json');
    if (previous?.runId === run.id) {
      await env.CACHE.put('state', JSON.stringify({ ...state, status: 'succeeded', error: null }));
      return;
    }
    state.runId = run.id;
    if (run.status !== 'SUCCEEDED') throw new Error(`Scraper ${run.status}`);
    const posts = await api(env, `/datasets/${run.defaultDatasetId}/items?limit=10&clean=true`);
    const post = newest(posts);
    if (!post) throw new Error('No valid Firelands posts');
    if (previous && Date.parse(post.timestamp) < Date.parse(previous.post.timestamp)) throw new Error('Older result rejected');
    const image = await media(post.displayUrl);
    const key = `media/${post.shortCode}/${run.id}`;
    await env.CACHE.put(key, image.data, { metadata: { contentType: image.type } });
    const feed = { updatedAt: new Date().toISOString(), source: 'Apify Instagram Scraper', runId: run.id, post: { id: post.shortCode, url: `https://www.instagram.com/p/${post.shortCode}/`, timestamp: post.timestamp, caption: post.caption || '', type: post.type, image: `/${key}` } };
    await env.CACHE.put('feed', JSON.stringify(feed));
    // Keep the prior generation so cached manifests continue to resolve.
    if (state.retiredMedia) await env.CACHE.delete(state.retiredMedia);
    state = { ...state, status: 'succeeded', error: null, finishedAt: feed.updatedAt, permalink: feed.post.url, postTimestamp: post.timestamp, runChargeUsd: run.usageTotalUsd ?? null, retiredMedia: previous?.post.image?.slice(1) };
  } catch (error) {
    state.status = 'failed'; state.error = error.message; state.finishedAt = new Date().toISOString();
    console.error(JSON.stringify({ event: 'candidate-refresh-failed', error: error.message }));
  }
  await env.CACHE.put('state', JSON.stringify(state));
}
export default {
  async fetch(request, env, ctx) {
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
    const path = new URL(request.url).pathname;
    if (path === '/health') return json({ service: 'Firelands Instagram source', state: await env.CACHE.get('state', 'json') });
    if (path === '/feed.json') { let feed = await env.CACHE.get('feed', 'json'); if (feed) { ctx.waitUntil(refresh(env).catch(error => console.error(error.message))); } else { await refresh(env); feed = await env.CACHE.get('feed', 'json'); } return json(feed || { status: 'awaiting-first-refresh' }, feed ? 200 : 503); }
    if (/^\/media\/[\w-]+\/[\w-]+$/.test(path)) {
      const m = await env.CACHE.getWithMetadata(path.slice(1), 'arrayBuffer');
      if (!m.value) return new Response('Not found', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : m.value, { headers: { 'Content-Type': m.metadata.contentType, 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
    }
    return json({ service: 'Firelands Instagram source', feed: '/feed.json', health: '/health' });
  }
};
