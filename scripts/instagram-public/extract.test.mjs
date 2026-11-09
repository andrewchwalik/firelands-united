import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPosts, validMedia } from './extract.mjs';
const post = (code, time, username = 'firelandsunited') => ({ shortcode: code, taken_at: time,
  user: { username }, image_versions2: { candidates: [{ url: 'https://scontent.cdninstagram.com/image.jpg' }] } });
test('sorts by publication date, not pinned placement', () => {
  assert.deepEqual(extractPosts([post('pinned', 1700000000), post('new', 1750000000)], 'firelandsunited').map(p => p.shortcode), ['new', 'pinned']);
});
test('rejects unrelated users, avatars, missing dates and invalid media hosts', () => {
  assert.equal(extractPosts([post('other', 1700000000, 'other'), { profile_pic_url: 'https://scontent.cdninstagram.com/avatar.jpg' }, post('bad', 0)], 'firelandsunited').length, 0);
  assert.equal(validMedia('https://cdninstagram.com.attacker.test/a'), false);
  assert.equal(validMedia('http://localhost/a'), false);
});
test('extracts captions and video from structured response', () => {
  const data = { data: { edges: [{ node: { ...post('video', 1700000000), media_type: 2,
    caption: { text: 'Club update' }, video_versions: [{ url: 'https://scontent.cdninstagram.com/video.mp4' }] } }] } };
  const result = extractPosts(data, 'firelandsunited')[0];
  assert.equal(result.caption, 'Club update');
  assert.equal(result.media_type, 'VIDEO');
  assert.ok(result.video_url.endsWith('.mp4'));
});

test('accepts confirmed coauthors but not mentions or tags', () => {
  const collab = { ...post('collab', 1700000000, 'andrewchwalik'),
    coauthor_producers: [{ username: 'FirelandsUnited' }] };
  const mention = { ...post('mention', 1700000000, 'other'),
    caption: { text: '@firelandsunited' }, usertags: [{ username: 'firelandsunited' }] };
  const results = extractPosts([collab, mention], 'firelandsunited');
  assert.equal(results.length, 1);
  assert.equal(results[0].shortcode, 'collab');
  assert.equal(results[0].username, 'firelandsunited');
  assert.equal(results[0].author_username, 'andrewchwalik');
});

test('failed downloads and older results preserve the saved feed', async () => {
  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { saveSnapshot } = await import('./save.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'instagram-test-'));
  const original = JSON.stringify({ posts: [{ timestamp: '2026-10-11T23:52:22.000Z' }] });
  try {
    await writeFile(join(dir, 'feed.json'), original);
    await assert.rejects(saveSnapshot(dir, { timestamp: '2026-09-17T17:11:43.000Z' }), /older/);
    await assert.rejects(saveSnapshot(dir, { timestamp: '2026-11-01T00:00:00.000Z', image_url: 'https://scontent.cdninstagram.com/a.jpg' }, async () => { throw new Error('offline'); }), /offline/);
    assert.equal(await readFile(join(dir, 'feed.json'), 'utf8'), original);
  } finally { await rm(dir, { recursive: true }); }
});
