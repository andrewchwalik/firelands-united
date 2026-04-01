const DEFAULT_LIMIT = 1;
const MAX_LIMIT = 3;
const CACHE_SECONDS = 300;
const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/firelandsunited/";
const INSTAGRAM_USERNAME = "firelandsunited";

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

function stripInstagramDescription(value) {
  return decodeHtml(value || "")
    .replace(/\s+on Instagram:.*$/i, "")
    .replace(/^Instagram:\s*/i, "")
    .trim();
}

function getMetaContent(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function getLatestPostPath(html) {
  const matches = [
    ...html.matchAll(/href="\/(p|reel)\/([^"\/?#]+)\/?"/g),
    ...html.matchAll(/"permalink":"https:\\\/\\\/www\.instagram\.com\\\/(p|reel)\\\/([^"\\]+)\\\//g)
  ];

  for (const match of matches) {
    const type = match[1];
    const shortcode = match[2];
    if (type && shortcode) {
      return `/${type}/${shortcode}/`;
    }
  }

  return "";
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error(`Instagram page request failed (${response.status})`);
  }

  return response.text();
}

async function fetchInstagramFeed(limit) {
  const profileHtml = await fetchHtml(INSTAGRAM_PROFILE_URL);
  const latestPath = getLatestPostPath(profileHtml);

  if (!latestPath) {
    throw new Error("Could not determine latest Instagram post.");
  }

  const postUrl = new URL(latestPath, INSTAGRAM_PROFILE_URL).toString();
  const postHtml = await fetchHtml(postUrl);

  const profilePicture = getMetaContent(profileHtml, "og:image");
  const username = getMetaContent(profileHtml, "og:title")
    .replace(/\s*\(@.*$/, "")
    .trim() || INSTAGRAM_USERNAME;

  const imageUrl = getMetaContent(postHtml, "og:image");
  const caption = stripInstagramDescription(getMetaContent(postHtml, "og:description"));
  const timestamp = getMetaContent(postHtml, "article:published_time");

  if (!imageUrl) {
    throw new Error("Could not determine latest Instagram image.");
  }

  return {
    posts: [
      {
        id: latestPath.replace(/\//g, ""),
        caption,
        permalink: postUrl,
        media_type: "IMAGE",
        image_url: imageUrl,
        timestamp
      }
    ].slice(0, Math.max(1, Math.min(MAX_LIMIT, limit))),
    profile: {
      username: INSTAGRAM_USERNAME,
      profile_picture_url: profilePicture
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
    const requestedLimit = Number(reqUrl.searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(MAX_LIMIT, requestedLimit))
      : DEFAULT_LIMIT;

    const forceRefresh = reqUrl.searchParams.get("refresh") === "1";
    const cache = caches.default;
    const cacheKey = new Request(`https://firelandsunited-cache/instagram?limit=${limit}`);
    const staleKey = new Request(`https://firelandsunited-cache/instagram-latest?limit=${limit}`);

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
      const data = await fetchInstagramFeed(limit);
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
