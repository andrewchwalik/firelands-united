import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refresh } from './refresh-instagram-rsshub.mjs';

const output = await mkdtemp(join(tmpdir(), 'instagram-refresh-'));
const originalFetch = globalThis.fetch;
const fixture = {
  version: 'https://jsonfeed.org/version/1.1',
  home_page_url: 'https://www.instagram.com/firelandsunited/',
  items: [{ id: 'latest', url: 'https://www.instagram.com/p/test/', title: 'Club news',
    image: 'https://scontent.cdninstagram.com/test.jpg', date_published: '2026-11-09T12:00:00Z' }]
};
try {
  globalThis.fetch = async url => String(url).startsWith('http://127.0.0.1:1200/')
    ? Response.json(fixture)
    : new Response(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { headers: { 'Content-Type': 'image/jpeg' } });
  const snapshot = await refresh({ output });
  assert.equal(snapshot.posts[0].id, 'latest');
  assert.match(snapshot.posts[0].image_url, /^\/data\/instagram\/[a-f0-9]{64}\.jpg$/);
  const before = await readFile(join(output, 'feed.json'), 'utf8');
  globalThis.fetch = async () => new Response('Blocked', { status: 429 });
  await assert.rejects(refresh({ output }), /429/);
  assert.equal(await readFile(join(output, 'feed.json'), 'utf8'), before);
  globalThis.fetch = async url => String(url).startsWith('http:') ? Response.json(fixture)
    : new Response('<html>Login</html>', { headers: { 'Content-Type': 'image/jpeg' } });
  await assert.rejects(refresh({ output }), /not a supported image/);
  assert.equal(await readFile(join(output, 'feed.json'), 'utf8'), before);
  globalThis.fetch = async () => Response.json({ ...fixture, items: [] });
  await assert.rejects(refresh({ output }), /No usable/);
  assert.equal(await readFile(join(output, 'feed.json'), 'utf8'), before);
  await assert.rejects(refresh({ output, endpoint: 'https://rsshub.app/' }), /local RSSHub/);
  console.log('Static Instagram refresh tests passed, including failure preservation.');
} finally {
  globalThis.fetch = originalFetch;
  await rm(output, { recursive: true, force: true });
}
