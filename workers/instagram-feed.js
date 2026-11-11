const SOURCE = 'https://firelands-instagram-candidate.firelandsunited.workers.dev';
const CACHE_SECONDS = 300;

export function normalizeFeed(data) {
  const post = data?.post;
  if (!post || !/^[\w-]+$/.test(post.id || '') ||
      !/^\/media\/[\w-]+\/[\w-]+$/.test(post.image || '') ||
      !Number.isFinite(Date.parse(post.timestamp))) {
    throw new Error('Invalid saved Instagram post');
  }
  return {
    posts: [{
      id: post.id,
      caption: post.caption || 'View this post on Instagram',
      permalink: `https://www.instagram.com/p/${post.id}/`,
      media_type: post.type === 'Video' ? 'VIDEO' : 'IMAGE',
      image_url: SOURCE + post.image,
      timestamp: post.timestamp
    }],
    profile: {
      username: 'firelandsunited',
      profile_picture_url: 'https://firelandsunited.com/img/firelands-badge.png'
    },
    updated_at: data.updatedAt,
    source: 'apify-cached'
  };
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowed = ['https://firelandsunited.com', 'https://www.firelandsunited.com'];
    const headers = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
    const cache = caches.default;
    const key = new Request('https://firelandsunited-cache/apify-v1/instagram');
    const staleKey = new Request('https://firelandsunited-cache/apify-v1/instagram-last-good');
    const respond = (r, stale = false) => {
      const h = new Headers(r.headers);
      for (const [k, v] of Object.entries(headers)) h.set(k, v);
      h.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
      if (stale) h.set('X-Firelands-Stale', '1');
      return new Response(r.body, { status: r.status, headers: h });
    };
    const cached = await cache.match(key);
    if (cached) return respond(cached);
    try {
      const upstream = await env.INSTAGRAM_SOURCE.fetch(`${SOURCE}/feed.json`, { signal: AbortSignal.timeout(25000), redirect: 'manual' });
      if (!upstream.ok) throw new Error('Saved feed unavailable');
      const data = normalizeFeed(await upstream.json());
      const response = Response.json(data, { headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });
      const stale = Response.json(data, { headers: { 'Cache-Control': 'public, max-age=604800' } });
      ctx.waitUntil(Promise.all([cache.put(key, response.clone()), cache.put(staleKey, stale)]));
      return respond(response);
    } catch (error) {
      console.error(JSON.stringify({ event: 'instagram-feed-error', message: error.message }));
      const stale = await cache.match(staleKey);
      if (stale) return respond(stale, true);
      return Response.json({ error: 'Could not load Instagram posts' }, { status: 502, headers: { ...headers, 'Cache-Control': 'no-store' } });
    }
  }
};
