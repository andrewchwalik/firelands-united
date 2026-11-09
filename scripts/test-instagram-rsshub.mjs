import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../workers/instagram-rsshub.js', import.meta.url), 'utf8');
const { default: worker, normalize, mediaUrl, refresh } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const image = 'https://scontent.cdninstagram.com/photo.jpg';
const item = (id, date, extra = {}) => ({ id, url: `https://www.instagram.com/p/${id}/`, title: 'Club &amp; community', date_published: date, image, ...extra });
const feed = { version: 'https://jsonfeed.org/version/1.1', icon: image, items: [item('old', '2026-01-01'), item('new', '2026-11-01')] };
assert.equal(normalize(feed).posts[0].id, 'new');
assert.equal(normalize(feed).posts[0].caption, 'Club & community');
assert.equal(normalize({ ...feed, items: [item('reel', '2026-11-01', { image: null, content_html: `<video poster='${image}'></video>`, attachments: [{ url: 'https://cdninstagram.com/movie.mp4', mime_type: 'video/mp4' }] })] }).posts[0].source_image, image);
assert.equal(mediaUrl('https://cdninstagram.com.evil.test/photo'), null);
assert.equal(mediaUrl('http://127.0.0.1/photo'), null);
assert.throws(() => normalize({ items: [] }));
assert.throws(() => normalize({ ...feed, items: [item('bad', '', { url: 'javascript:alert(1)' })] }));

const entries = new Map();
const storage = {
  async get(key, type) { const entry = entries.get(key); return !entry ? null : type === 'json' ? JSON.parse(entry.value) : entry.value; },
  async put(key, value, options) { entries.set(key, { value, metadata: options?.metadata }); },
  async getWithMetadata(key) { return entries.get(key) || { value: null }; }
};
const env = { INSTAGRAM_STATE: storage, RSSHUB_FEED_URL: 'https://feeds.example.test/instagram/user/firelandsunited' };
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async url => {
  calls++;
  return String(url).includes('feeds.example.test') ? Response.json(feed) : new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } });
};
try {
  assert.equal((await worker.fetch(new Request('https://worker.test/'), env)).status, 503);
  await refresh(env);
  const before = calls;
  const response = await worker.fetch(new Request('https://worker.test/?limit=1&refresh=1'), env);
  const data = await response.json();
  assert.equal(data.posts.length, 1);
  assert.equal(data.posts[0].id, 'new');
  assert.equal(calls, before, 'Visitors must not trigger upstream fetches');
  const savedImage = await worker.fetch(new Request(data.posts[0].image_url), env);
  assert.equal(savedImage.status, 200);
  assert.deepEqual(new Uint8Array(await savedImage.arrayBuffer()), new Uint8Array([1, 2, 3]));
  const snapshot = entries.get('instagram:snapshot').value;
  globalThis.fetch = async () => new Response('Rate limited', { status: 429 });
  await assert.rejects(refresh(env));
  assert.equal(entries.get('instagram:snapshot').value, snapshot);
  assert.equal((await worker.fetch(new Request('https://worker.test/'), env)).status, 200);
  globalThis.fetch = async url => String(url).includes('feeds.example.test') ? Response.json(feed) : new Response('expired', { status: 403 });
  await assert.rejects(refresh(env));
  assert.equal(entries.get('instagram:snapshot').value, snapshot);
  assert.equal((await worker.fetch(new Request('https://worker.test/?asset=../secret'), env)).status, 400);
  assert.equal((await worker.fetch(new Request('https://worker.test/', { method: 'POST' }), env)).status, 405);
  await assert.rejects(refresh({ ...env, RSSHUB_FEED_URL: 'https://rsshub.app/instagram/user/firelandsunited' }));
  console.log('RSSHub Instagram tests passed: normalization, newest-first, reel posters, safe URLs, saved images, failure fallback, request isolation.');
} finally { globalThis.fetch = originalFetch; }
