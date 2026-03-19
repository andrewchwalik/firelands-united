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

async function fetchLatestYoutubeVideo() {
  const channelUrl = "https://www.youtube.com/@FirelandsUnited/videos";
  const pageResponse = await fetch(channelUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!pageResponse.ok) {
    throw new Error(`YouTube page request failed (${pageResponse.status})`);
  }

  const html = await pageResponse.text();
  const channelIdMatch = html.match(/"channelId":"(UC[^"]+)"/);
  if (!channelIdMatch) {
    throw new Error("Could not determine YouTube channel id.");
  }

  const rssResponse = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdMatch[1]}`
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
    "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=andrewchwalik.bsky.social&limit=1"
  );

  if (!response.ok) {
    throw new Error(`Bluesky request failed (${response.status})`);
  }

  const data = await response.json();
  const item = data?.feed?.[0];
  const post = item?.post;
  const author = post?.author;
  const record = post?.record;

  if (!post?.uri || !record) {
    throw new Error("No Bluesky posts found.");
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

    const cache = caches.default;
    const cacheKey = new Request("https://firelandsunited-cache/social-feed");
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("Access-Control-Allow-Origin", allowOrigin);
      headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      return new Response(cached.body, { status: cached.status, headers });
    }

    try {
      const [youtube, bluesky] = await Promise.all([
        fetchLatestYoutubeVideo(),
        fetchLatestBlueskyPost()
      ]);

      const response = jsonResponse(
        {
          youtube,
          bluesky,
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
          error: "Could not load social feed",
          detail: String(error?.message || error)
        },
        502,
        corsHeaders
      );
    }
  }
};
