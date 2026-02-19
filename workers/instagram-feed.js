const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const CACHE_SECONDS = 300;

function jsonResponse(body, status, corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`
    }
  });
}

function resolveImage(item) {
  if (item.media_type === "IMAGE" && item.media_url) return item.media_url;
  if (item.media_type === "VIDEO" && item.thumbnail_url) return item.thumbnail_url;
  if (item.media_type === "CAROUSEL_ALBUM") {
    const firstChild = item.children?.data?.[0];
    if (firstChild?.media_url) return firstChild.media_url;
    if (item.thumbnail_url) return item.thumbnail_url;
  }
  return item.media_url || item.thumbnail_url || "";
}

function normalizePost(item) {
  return {
    id: item.id,
    caption: item.caption || "",
    permalink: item.permalink || "",
    media_type: item.media_type || "",
    image_url: resolveImage(item),
    timestamp: item.timestamp || ""
  };
}

async function fetchInstagramPosts(env, limit) {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const userId = env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    throw new Error("Instagram secrets are not configured.");
  }

  const fields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
    "children{media_type,media_url,thumbnail_url}"
  ].join(",");

  const url = new URL(`https://graph.facebook.com/v23.0/${userId}/media`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Instagram API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const posts = (data.data || [])
    .map(normalizePost)
    .filter((post) => post.image_url && post.permalink);

  return posts;
}

export default {
  async fetch(request, env, ctx) {
    const allowedOrigins = new Set([
      "https://firelandsunited.com",
      "https://www.firelandsunited.com"
    ]);
    const origin = request.headers.get("Origin") || "";
    const allowOrigin = allowedOrigins.has(origin) ? origin : "https://firelandsunited.com";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    }

    const reqUrl = new URL(request.url);
    const requestedLimit = Number(reqUrl.searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(MAX_LIMIT, requestedLimit))
      : DEFAULT_LIMIT;

    const cache = caches.default;
    const cacheKey = new Request(`https://firelandsunited-cache/instagram?limit=${limit}`);
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("Access-Control-Allow-Origin", allowOrigin);
      headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      return new Response(cached.body, { status: cached.status, headers });
    }

    try {
      const posts = await fetchInstagramPosts(env, limit);
      const response = jsonResponse(
        {
          posts,
          updated_at: new Date().toISOString()
        },
        200,
        corsHeaders
      );
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return jsonResponse(
        {
          error: "Could not load Instagram posts",
          detail: String(error?.message || error)
        },
        502,
        corsHeaders
      );
    }
  }
};
