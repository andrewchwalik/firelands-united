const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;
const CACHE_SECONDS = 300;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

function toUtcDateKey(value) {
  return value.toISOString().slice(0, 10);
}

function shouldSendTwoDayReminder(now, expiresAt) {
  const reminderDate = new Date(expiresAt.getTime() - (2 * ONE_DAY_MS));
  return toUtcDateKey(now) === toUtcDateKey(reminderDate);
}

async function sendDiscordReminder(env, content) {
  const webhook = env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });
}

async function runTokenExpiryReminder(env) {
  const expiresRaw = env.INSTAGRAM_TOKEN_EXPIRES_AT;
  if (!expiresRaw) return;

  const expiresAt = new Date(expiresRaw);
  if (Number.isNaN(expiresAt.getTime())) return;

  const now = new Date();
  if (!shouldSendTwoDayReminder(now, expiresAt)) return;

  const message = [
    "It's time to update the access token for the Instagram feed element on the Firelands United website. Here are the steps to do that.",
    "",
    "1) Go to the following link and generate a new *long-lived* access token: https://developers.facebook.com/tools/explorer/?method=GET&path=me%2Faccounts&version=v25.0",
    "",
    "2) Paste this in terminal, replacing \"LONG_LIVED_USER_TOKEN\" with the new long-lived token before pasting: curl 'https://graph.facebook.com/v25.0/me/accounts?access_token=LONG_LIVED_USER_TOKEN'",
    "",
    "3) From the terminal output, copy the access_token under the Firelands United page object.",
    "",
    "4) Paste this in terminal and run: cd /Users/andrewchwaliksmacbook/Documents/GitHub/firelands-united/workers",
    "npx wrangler secret put INSTAGRAM_ACCESS_TOKEN --config wrangler-instagram.toml",
    "npx wrangler secret put INSTAGRAM_TOKEN_EXPIRES_AT --config wrangler-instagram.toml",
    "npx wrangler deploy --config wrangler-instagram.toml",
    "curl \"https://firelandsunited-instagram-feed.chwalik.workers.dev?limit=1\"",
    "",
    "5) When prompted for INSTAGRAM_ACCESS_TOKEN, paste the new page access token copied from step 3.",
    "",
    "6) When prompted for INSTAGRAM_TOKEN_EXPIRES_AT, paste the new expiry in this format: 2026-04-20T00:00:00Z"
  ].join("\n");

  await sendDiscordReminder(env, message);
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

async function fetchInstagramProfile(env) {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  const userId = env.INSTAGRAM_USER_ID;

  if (!token || !userId) {
    return { username: "firelandsunited", profile_picture_url: "" };
  }

  try {
    const url = new URL(`https://graph.facebook.com/v23.0/${userId}`);
    url.searchParams.set("fields", "username,profile_picture_url");
    url.searchParams.set("access_token", token);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return { username: "firelandsunited", profile_picture_url: "" };
    }

    const data = await response.json();
    return {
      username: data.username || "firelandsunited",
      profile_picture_url: data.profile_picture_url || ""
    };
  } catch (error) {
    return { username: "firelandsunited", profile_picture_url: "" };
  }
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
      const [posts, profile] = await Promise.all([
        fetchInstagramPosts(env, limit),
        fetchInstagramProfile(env)
      ]);
      const response = jsonResponse(
        {
          posts,
          profile,
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
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runTokenExpiryReminder(env));
  }
};
