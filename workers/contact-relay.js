const MAX_RESUME_SIZE = 8 * 1024 * 1024;

function buildCorsHeaders(origin, allowedOrigins) {
  const allowOrigin = allowedOrigins.has(origin) ? origin : "https://firelandsunited.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
      availability: String(formData.get("availability") || "").trim(),
      interest: String(formData.get("interest") || "").trim(),
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
    availability: String(body?.availability || "").trim(),
    interest: String(body?.interest || "").trim(),
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

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
    }

    try {
      const body = await parseRequestBody(request);
      const formType = body.formType;
      const name = body.name;
      const email = body.email;
      const timestamp = body.timestamp;

      if (formType === "internship-application") {
        const role = body.role;
        const phone = body.phone;
        const school = body.school;
        const availability = body.availability;
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
          `School / Organization / Current Role: ${school || "N/A"}\n` +
          `Availability: ${availability || "N/A"}\n\n` +
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
