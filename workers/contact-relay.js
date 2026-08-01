const MAX_RESUME_SIZE = 8 * 1024 * 1024;
const DISCORD_CONTENT_LIMIT = 1900;

const SUPERLATIVE_CATEGORIES = [
  "Most likely to become a professional soccer player",
  "Most likely to get in a fist fight with a ref",
  "Most likely to miss a sitter",
  "Most likely to forget their boots",
  "Most likely to keep a positive attitude no matter the situation",
  "Most likely to hype the team up",
  "Most likely to have the best goal celebration",
  "Most likely to put a free kick on the back of the net",
  "Most likely to hang up the boots to become a hair model",
  "Most likely to have the best excuse for missing practice",
  "Most likely to become a future coach",
  "Most likely to be the first one at practice",
  "Most likely to successfully pull off a 5-star skill move",
  "Most likely to show up with the best pregame fit",
  "Most likely to bring the best sideline energy"
];

function buildCorsHeaders(origin, allowedOrigins) {
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://firelandsunited.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function parseRequestBody(request) {
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    return {
      formType: String(formData.get("formType") || "contact").trim(),
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      timestamp: String(formData.get("timestamp") || "").trim(),
      subject: String(formData.get("subject") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      newsletterOptIn: String(formData.get("newsletterOptIn") || "").trim() === "true",
      role: String(formData.get("role") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      school: String(formData.get("school") || "").trim(),
      interest: String(formData.get("interest") || "").trim(),
      team: String(formData.get("team") || "").trim(),
      teamLabel: String(formData.get("teamLabel") || "").trim(),
      picks: [],
      resume: formData.get("resume")
    };
  }

  const body = await request.json();
  return {
    formType: String(body?.formType || "contact").trim(),
    name: String(body?.name || "").trim(),
    email: String(body?.email || "").trim(),
    timestamp: String(body?.timestamp || "").trim(),
    subject: String(body?.subject || "").trim(),
    message: String(body?.message || "").trim(),
    newsletterOptIn: Boolean(body?.newsletterOptIn),
    role: String(body?.role || "").trim(),
    phone: String(body?.phone || "").trim(),
    school: String(body?.school || "").trim(),
    interest: String(body?.interest || "").trim(),
    team: String(body?.team || "").trim(),
    teamLabel: String(body?.teamLabel || "").trim(),
    picks: Array.isArray(body?.picks) ? body.picks : [],
    resume: body?.resume || null
  };
}

async function postToDiscord(webhookUrl, content, resume) {
  if (resume && typeof resume === "object" && "arrayBuffer" in resume) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content }));
    form.append("files[0]", resume, resume.name || "resume.pdf");
    return fetch(webhookUrl, {
      method: "POST",
      body: form
    });
  }

  return fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });
}

function splitDiscordContent(content) {
  const chunks = [];
  let current = "";

  for (const line of content.split("\n")) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= DISCORD_CONTENT_LIMIT) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    current = line;
  }

  if (current) chunks.push(current);
  return chunks;
}

async function postTextToDiscord(webhookUrl, content) {
  const chunks = splitDiscordContent(content);
  const responses = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const prefix = chunks.length > 1 ? `Part ${index + 1}/${chunks.length}\n` : "";
    responses.push(await postToDiscord(webhookUrl, `${prefix}${chunks[index]}`));
  }

  return responses;
}

function normalizeSuperlativesTeam(team, teamLabel) {
  const raw = `${team || ""} ${teamLabel || ""}`.toLowerCase();
  if (raw.includes("women")) return "women";
  return "men";
}

function getSuperlativesWebhook(env, team) {
  if (team === "women") {
    return env.WOMENS_SUPERLATIVES_DISCORD_WEBHOOK_URL ||
      env.SUPERLATIVES_DISCORD_WEBHOOK_URL ||
      env.DISCORD_WEBHOOK_URL;
  }

  return env.SUPERLATIVES_DISCORD_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
}

function normalizePicks(picks) {
  return picks
    .map((pick) => ({
      category: String(pick?.category || "").trim(),
      player: String(pick?.player || "").trim()
    }))
    .filter((pick) => pick.category && pick.player);
}

async function computeSuperlativesTally(kv, team) {
  const prefix = `superlatives:ballots:${team}:`;
  const tally = Object.fromEntries(SUPERLATIVE_CATEGORIES.map((category) => [category, {}]));
  let ballotCount = 0;
  let cursor;

  do {
    const page = await kv.list({ prefix, cursor });
    cursor = page.cursor;

    for (const key of page.keys) {
      const ballot = await kv.get(key.name, "json");
      if (!ballot || !Array.isArray(ballot.picks)) continue;
      ballotCount += 1;

      for (const pick of ballot.picks) {
        const category = String(pick.category || "").trim();
        const player = String(pick.player || "").trim();
        if (!category || !player) continue;
        if (!tally[category]) tally[category] = {};
        tally[category][player] = (tally[category][player] || 0) + 1;
      }
    }
  } while (cursor);

  const categories = Object.entries(tally).map(([category, counts]) => {
    const entries = Object.entries(counts)
      .map(([player, votes]) => ({ player, votes }))
      .sort((a, b) => b.votes - a.votes || a.player.localeCompare(b.player));
    const topVotes = entries[0]?.votes || 0;
    return {
      category,
      leaders: entries.filter((entry) => entry.votes === topVotes && topVotes > 0),
      counts: entries
    };
  });

  return {
    team,
    ballotCount,
    updatedAt: new Date().toISOString(),
    categories
  };
}

function formatSuperlativesTally(teamLabel, tally) {
  const lines = tally.categories.map((category) => {
    if (!category.leaders.length) return `${category.category}: No votes yet`;
    const leaderText = category.leaders
      .map((leader) => `${leader.player} (${leader.votes})`)
      .join(" / ");
    return `${category.category}: ${leaderText}`;
  });

  return [
    `**Current ${teamLabel} Superlatives Leaders**`,
    `Ballots counted: ${tally.ballotCount}`,
    "",
    ...lines
  ].join("\n");
}

export default {
  async fetch(request, env) {
    const allowedOrigins = new Set([
      "https://firelandsunited.com",
      "https://www.firelandsunited.com"
    ]);

    const origin = request.headers.get("Origin") || "";
    const corsHeaders = buildCorsHeaders(origin, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      if (!env.SUPERLATIVES_KV) {
        return jsonResponse({ error: "Superlatives storage is not configured" }, 500, corsHeaders);
      }

      const url = new URL(request.url);
      const team = normalizeSuperlativesTeam(url.searchParams.get("team") || "", "");
      const tally = await computeSuperlativesTally(env.SUPERLATIVES_KV, team);
      return jsonResponse(tally, 200, corsHeaders);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    }

    try {
      const body = await parseRequestBody(request);
      const formType = body.formType;
      const name = body.name;
      const email = body.email;
      const timestamp = body.timestamp;

      if (formType === "superlatives-vote") {
        if (!env.SUPERLATIVES_KV) {
          return jsonResponse({ error: "Superlatives storage is not configured" }, 500, corsHeaders);
        }

        const team = normalizeSuperlativesTeam(body.team, body.teamLabel);
        const teamLabel = body.teamLabel || (team === "women" ? "Women's First Team" : "Men's First Team");
        const picks = normalizePicks(body.picks);

        if (!name || picks.length !== SUPERLATIVE_CATEGORIES.length) {
          return jsonResponse({ error: "Missing required fields" }, 400, corsHeaders);
        }

        const ballot = {
          id: crypto.randomUUID(),
          formType,
          team,
          teamLabel,
          name,
          timestamp,
          submittedAt: new Date().toISOString(),
          picks
        };

        await env.SUPERLATIVES_KV.put(
          `superlatives:ballots:${team}:${ballot.id}`,
          JSON.stringify(ballot)
        );

        const tally = await computeSuperlativesTally(env.SUPERLATIVES_KV, team);
        await env.SUPERLATIVES_KV.put(
          `superlatives:tally:${team}`,
          JSON.stringify(tally)
        );

        const voteContent =
          `${timestamp} | ${name}\n` +
          `**${teamLabel} Superlatives Ballot**\n` +
          picks.map((pick) => `${pick.category}: ${pick.player}`).join("\n");

        const superlativesWebhook = getSuperlativesWebhook(env, team);
        const voteResponse = await postToDiscord(superlativesWebhook, voteContent);
        if (!voteResponse.ok) {
          return jsonResponse({ error: "Discord relay failed" }, 502, corsHeaders);
        }

        await postTextToDiscord(superlativesWebhook, formatSuperlativesTally(teamLabel, tally));
        return jsonResponse({ ok: true, tally }, 200, corsHeaders);
      }

      if (formType === "internship-application") {
        const role = body.role;
        const phone = body.phone;
        const school = body.school;
        const interest = body.interest;
        const resume = body.resume;

        if (!name || !email || !role || !interest || !resume) {
          return jsonResponse({ error: "Missing required fields" }, 400, corsHeaders);
        }

        const resumeType = String(resume.type || "").toLowerCase();
        const resumeName = String(resume.name || "resume.pdf");
        const isPdf = resumeType === "application/pdf" || resumeName.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
          return jsonResponse({ error: "Resume must be a PDF" }, 400, corsHeaders);
        }

        if (typeof resume.size === "number" && resume.size > MAX_RESUME_SIZE) {
          return jsonResponse({ error: "Resume file is too large" }, 400, corsHeaders);
        }

        const discordContent =
          `${timestamp} | ${name} | ${email}\n` +
          `**Internship Application: ${role}**\n` +
          `Phone: ${phone || "N/A"}\n` +
          `School / Organization / Current Role: ${school || "N/A"}\n\n` +
          `${interest}`;

        const internshipWebhook = env.INTERNSHIP_DISCORD_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
        const discordResponse = await postToDiscord(internshipWebhook, discordContent, resume);

        if (!discordResponse.ok) {
          return jsonResponse({ error: "Discord relay failed" }, 502, corsHeaders);
        }

        return jsonResponse({ ok: true }, 200, corsHeaders);
      }

      const subject = body.subject;
      const message = body.message;
      const newsletterOptIn = body.newsletterOptIn;

      if (!name || !email || !subject || !message) {
        return jsonResponse({ error: "Missing required fields" }, 400, corsHeaders);
      }

      const discordContent =
        `${timestamp} | ${name} | ${email}\n` +
        `Newsletter Opt-In: ${newsletterOptIn ? "Yes" : "No"}\n\n` +
        `**${subject}** | ${message}`;

      const discordResponse = await postToDiscord(env.DISCORD_WEBHOOK_URL, discordContent);

      if (!discordResponse.ok) {
        return jsonResponse({ error: "Discord relay failed" }, 502, corsHeaders);
      }

      return jsonResponse({ ok: true }, 200, corsHeaders);
    } catch (error) {
      return jsonResponse({ error: "Invalid request" }, 400, corsHeaders);
    }
  }
};
