export default {
  async fetch(request, env) {
    const allowedOrigins = new Set([
      "https://firelandsunited.com",
      "https://www.firelandsunited.com"
    ]);

    const origin = request.headers.get("Origin") || "";
    const allowOrigin = allowedOrigins.has(origin) ? origin : "https://firelandsunited.com";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const body = await request.json();
      const name = String(body?.name || "").trim();
      const email = String(body?.email || "").trim();
      const timestamp = String(body?.timestamp || "").trim();
      const subject = String(body?.subject || "").trim();
      const message = String(body?.message || "").trim();

      if (!name || !email || !subject || !message) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const discordContent = `"${name}" | "${email}" | "${timestamp}"\n"${subject}" | "${message}"`;

      const discordResponse = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: discordContent })
      });

      if (!discordResponse.ok) {
        return new Response(JSON.stringify({ error: "Discord relay failed" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
