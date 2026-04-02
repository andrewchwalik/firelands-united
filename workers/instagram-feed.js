const DEFAULT_LIMIT = 1;
const MAX_LIMIT = 3;
const CACHE_SECONDS = 300;
const CACHE_VERSION = "v4";
const RSS_APP_FEED_URL = "https://rss.app/feeds/v1.1/SVTiUxDnFwnPa8hk.json";

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

function decodeHtml(value) {
  return (value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value) {
  return decodeHtml((value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function extractImageFromHtml(value) {
  const match = (value || "").match(/<img[^>]+src="([^"]+)"/i);
  return match?.[1] ? decodeHtml(match[1]) : "";
}

function buildProxyUrl(requestUrl, sourceUrl) {
  const proxyUrl = new URL(requestUrl);
  proxyUrl.search = "";
  proxyUrl.searchParams.set("proxy", sourceUrl);
  return proxyUrl.toString();
}

function normalizeFeedItem(item, requestUrl) {
  const imageUrl =
    item?.attachments?.[0]?.url
    || item?.image
    || extractImageFromHtml(item?.content_html)
    || "";

  return {
    id: item?.id || item?.url || "instagram-latest",
    caption: stripHtml(item?.content_text || item?.description || item?.title || "View this post on Instagram"),
    permalink: item?.external_url || item?.url || "https://www.instagram.com/firelandsunited/",
    media_type: "IMAGE",
    image_url: imageUrl ? buildProxyUrl(requestUrl, imageUrl) : "",
    timestamp: item?.date_published || item?.date_modified || ""
  };
}

async function proxyImage(sourceUrl, corsHeaders) {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Referer": "https://www.instagram.com/",
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    return new Response("Could not load image", {
      status: response.status,
      headers: corsHeaders
    });
  }

  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg");
  headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
  return new Response(response.body, {
    status: 200,
    headers
  });
}

async function fetchInstagramFeed(limit, requestUrl) {
  const response = await fetch(RSS_APP_FEED_URL, {
    headers: {
      "Accept": "application/feed+json, application/json;q=0.9, */*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`RSS.app request failed (${response.status})`);
  }

  const data = await response.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  const posts = items
    .slice(0, Math.max(1, Math.min(MAX_LIMIT, limit)))
    .map((item) => normalizeFeedItem(item, requestUrl))
    .filter((post) => post.image_url && post.permalink);

  if (!posts.length) {
    throw new Error("No Instagram posts were returned by RSS.app.");
  }

    return {
      posts,
      profile: {
        username: "firelandsunited",
        profile_picture_url: data?.favicon
          ? buildProxyUrl(requestUrl, data.favicon)
          : "/img/firelands-badge.png"
      }
    };
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
    const proxyTarget = reqUrl.searchParams.get("proxy");
    if (proxyTarget) {
      return proxyImage(proxyTarget, corsHeaders);
    }

    const requestedLimit = Number(reqUrl.searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(MAX_LIMIT, requestedLimit))
      : DEFAULT_LIMIT;

    const forceRefresh = reqUrl.searchParams.get("refresh") === "1";
    const cache = caches.default;
    const cacheKey = new Request(`https://firelandsunited-cache/${CACHE_VERSION}/instagram?limit=${limit}`);
    const staleKey = new Request(`https://firelandsunited-cache/${CACHE_VERSION}/instagram-latest?limit=${limit}`);

    if (!forceRefresh) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set("Access-Control-Allow-Origin", allowOrigin);
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        return new Response(cached.body, { status: cached.status, headers });
      }
    }

    try {
      const data = await fetchInstagramFeed(limit, request.url);
      const response = jsonResponse(
        {
          posts: data.posts,
          profile: data.profile,
          updated_at: new Date().toISOString()
        },
        200,
        corsHeaders
      );

      ctx.waitUntil(Promise.all([
        cache.put(cacheKey, response.clone()),
        cache.put(staleKey, response.clone())
      ]));

      return response;
    } catch (error) {
      const stale = await cache.match(staleKey);
      if (stale) {
        const headers = new Headers(stale.headers);
        headers.set("Access-Control-Allow-Origin", allowOrigin);
        headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        headers.set("X-Firelands-Stale", "1");
        return new Response(stale.body, { status: 200, headers });
      }

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
