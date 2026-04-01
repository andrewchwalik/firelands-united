const CACHE_SECONDS = 300;
const YOUTUBE_CHANNEL_ID = "UCC2Iyx0c5rfNrRbr1Vd4f8g";

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

async function fetchLatestYoutubeVideo() {
  const rssResponse = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`
  );
  if (!rssResponse.ok) {
    throw new Error(`YouTube RSS request failed (${rssResponse.status})`);
  }

  const xml = await rssResponse.text();
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
  if (!entryMatch) {
    throw new Error("No YouTube videos found.");
  }

  const entry = entryMatch[1];
  const getTag = (pattern) => {
    const match = entry.match(pattern);
    return match ? match[1].trim() : "";
  };

  const videoId = getTag(/<yt:videoId>([^<]+)<\/yt:videoId>/);
  const title = getTag(/<title>([^<]+)<\/title>/);
  const publishedAt = getTag(/<published>([^<]+)<\/published>/);
  const url = getTag(/<link[^>]+href="([^"]+)"/) || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "");

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
    const cacheKey = new Request(`https://firelandsunited-cache/social-feed${reqUrl.search}`);
    const staleKey = new Request("https://firelandsunited-cache/social-feed-latest");
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
