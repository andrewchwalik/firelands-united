const CACHE_SECONDS = 300;
const YOUTUBE_CHANNEL_HANDLE_URL = "https://www.youtube.com/@FirelandsUnited/videos";
const CACHE_VERSION = "v2";

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
    .replace(/\\u0026/g, "&")
    .replace(/\\u003d/g, "=")
    .replace(/\\u002F/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"");
}

async function fetchLatestYoutubeVideo() {
  const response = await fetch(YOUTUBE_CHANNEL_HANDLE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  if (!response.ok) {
    throw new Error(`YouTube page request failed (${response.status})`);
  }

  const html = await response.text();
  const videoIdMatch = html.match(/"videoId":"([^"]+)"/);
  if (!videoIdMatch?.[1]) {
    throw new Error("Could not determine latest YouTube video ID.");
  }

  const videoId = videoIdMatch[1];
  const titleMatch = html.match(new RegExp(`"videoId":"${videoId}".*?"title":\\{"runs":\\[\\{"text":"([^"]+)"\\}`, "s"));
  const publishedMatch = html.match(new RegExp(`"videoId":"${videoId}".*?"publishedTimeText":\\{"simpleText":"([^"]+)"\\}`, "s"));
  const title = decodeHtml(titleMatch?.[1] || "Watch on YouTube");
  const publishedAt = decodeHtml(publishedMatch?.[1] || "");
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  return {
    id: videoId,
    title,
    url,
    published_at: publishedAt,
    thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ""
  };
}

async function fetchLatestBlueskyPost() {
  const response = await fetch(
    "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=andrewchwalik.bsky.social&filter=posts_no_replies&limit=10"
  );

  if (!response.ok) {
    throw new Error(`Bluesky request failed (${response.status})`);
  }

  const data = await response.json();
  const item = (data?.feed || []).find((entry) => {
    const record = entry?.post?.record;
    return !!record?.text;
  });
  const post = item?.post;
  const author = post?.author;
  const record = post?.record;

  if (!post?.uri || !record) {
    throw new Error("No non-reply Bluesky posts found.");
  }

  const postId = post.uri.split("/").pop();
  const handle = author?.handle || "andrewchwalik.bsky.social";

  return {
    id: postId,
    text: record.text || "",
    posted_at: record.createdAt || "",
    url: postId ? `https://bsky.app/profile/${handle}/post/${postId}` : `https://bsky.app/profile/${handle}`,
    display_name: author?.displayName || "Andrew Chwalik",
    handle,
    avatar: author?.avatar || ""
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
    const forceRefresh = reqUrl.searchParams.get("refresh") === "1";
    const cache = caches.default;
    const cacheKey = new Request(`https://firelandsunited-cache/${CACHE_VERSION}/social-feed${reqUrl.search}`);
    const staleKey = new Request(`https://firelandsunited-cache/${CACHE_VERSION}/social-feed-latest`);
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
      const [youtubeResult, blueskyResult] = await Promise.allSettled([
        fetchLatestYoutubeVideo(),
        fetchLatestBlueskyPost()
      ]);

      const payload = {
        youtube: youtubeResult.status === "fulfilled" ? youtubeResult.value : null,
        bluesky: blueskyResult.status === "fulfilled" ? blueskyResult.value : null,
        errors: {
          youtube: youtubeResult.status === "rejected"
            ? String(youtubeResult.reason?.message || youtubeResult.reason || "Unknown error")
            : null,
          bluesky: blueskyResult.status === "rejected"
            ? String(blueskyResult.reason?.message || blueskyResult.reason || "Unknown error")
            : null
        },
        updated_at: new Date().toISOString()
      };

      if (!payload.youtube && !payload.bluesky) {
        return jsonResponse(
          {
            error: "Could not load social feed",
            detail: payload.errors
          },
          502,
          corsHeaders
        );
      }

      const response = jsonResponse(
        payload,
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
          error: "Could not load social feed",
          detail: String(error?.message || error)
        },
        502,
        corsHeaders
      );
    }
  }
};
