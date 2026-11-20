const origins = new Set(['https://firelandsunited.com', 'https://www.firelandsunited.com']);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {'Content-Type':'application/json', 'Cache-Control':'no-store', Vary:'Origin'};
    const reply = (body, status) => Response.json(body, {status, headers});
    if (!origins.has(origin)) return reply({ok:false}, 403);
    Object.assign(headers, {'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type'});
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers});
    if (request.method !== 'POST') return reply({ok:false}, 405);
    const length = Number(request.headers.get('Content-Length'));
    if (!request.body || length > 6000000) return reply({ok:false}, 413);
    if (!(await env.LIMITER.limit({key:request.headers.get('CF-Connecting-IP') || 'unknown'})).success) return reply({ok:false}, 429);
    try {
      // Mobile browsers can omit Content-Length. Bound the actual bytes as they arrive.
      const reader = request.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 6000000) {
          await reader.cancel();
          return reply({ok:false}, 413);
        }
        chunks.push(value);
      }
      // Only the server follows Google's redirect. Never forward browser cookies or headers.
      let result = await fetch(env.SHEETS_URL, {
        method:'POST', body:new Blob(chunks), headers:{'Content-Type':'text/plain;charset=UTF-8'}, redirect:'manual'
      });
      if (result.status === 302 || result.status === 303) {
        const location = new URL(result.headers.get('Location'));
        if (location.origin !== 'https://script.googleusercontent.com') return reply({ok:false}, 503);
        result = await fetch(location.href);
      }
      if (!result.ok) return reply({ok:false}, 503);
      const data = await result.json();
      return reply(data, data.ok ? 200 : 422);
    } catch {
      return reply({ok:false}, 503);
    }
  }
};
