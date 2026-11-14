const encoder = new TextEncoder();
export async function saveRegistration(env, envelope) {
  const id = envelope.data.registrationId;
  await env.REGISTRATIONS.prepare('INSERT INTO registrations (id, envelope, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(id, JSON.stringify(envelope), envelope.timestamp).run();
  return id;
}
async function sendToSheet(env, envelope) {
  // Retain the original submission/signature dates, but refresh the transport timestamp.
  const payload = JSON.stringify({...envelope, timestamp:new Date().toISOString()});
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.SHEETS_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signature = [...new Uint8Array(mac)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const response = await fetch(env.SHEETS_URL, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload,signature}),signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error(`google_http_${response.status}`);
  if (!(response.headers.get('Content-Type') || '').includes('application/json')) throw new Error('google_non_json');
  let result;
  try { result = await response.json(); } catch { throw new Error('google_invalid_json'); }
  if (!result.ok || result.registrationId !== envelope.data.registrationId) throw new Error('google_not_confirmed');
}
export async function deliverRegistration(env, id) {
  const now = Date.now();
  // An atomic lease prevents a request retry and the scheduled job delivering at once.
  const row = await env.REGISTRATIONS.prepare('UPDATE registrations SET lease_until = ?, attempts = attempts + 1 WHERE id = ? AND synced_at IS NULL AND lease_until <= ? RETURNING envelope, attempts')
    .bind(now + 45000, id, now).first();
  if (!row) return;
  let code = 'google_unavailable';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await sendToSheet(env, JSON.parse(row.envelope));
      await env.REGISTRATIONS.prepare('UPDATE registrations SET synced_at = ?, lease_until = 0, last_error = NULL WHERE id = ?').bind(new Date().toISOString(), id).run();
      console.log(JSON.stringify({event:'roster_synced',registrationId:id}));
      return;
    } catch (error) {
      // Never log submitted answers, upstream HTML, or credentials.
      code = /^google_[a-z_0-9]+$/.test(error.message) ? error.message : 'google_unavailable';
    }
  }
  const delay = Math.min(15, row.attempts) * 60000;
  await env.REGISTRATIONS.prepare('UPDATE registrations SET lease_until = 0, next_attempt = ?, last_error = ? WHERE id = ? AND synced_at IS NULL').bind(Date.now()+delay, code, id).run();
  console.warn(JSON.stringify({event:'roster_sync_pending',registrationId:id,code}));
}
export async function flushPending(env) {
  const {results} = await env.REGISTRATIONS.prepare('SELECT id FROM registrations WHERE synced_at IS NULL AND lease_until <= ? AND next_attempt <= ? ORDER BY created_at LIMIT 5').bind(Date.now(),Date.now()).all();
  await Promise.all(results.map(row=>deliverRegistration(env,row.id)));
}
