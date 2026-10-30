import assert from 'node:assert/strict';
import { fetchLatestYoutubeVideo } from '../workers/social-feed.js';

const originalFetch = globalThis.fetch;
try {
  const id = 'hO3oJbL8ohU';
  let metadataStatus = 200;
  let title = 'Cup Match "Round Two" & More';
  globalThis.fetch = async url => {
    if (url.endsWith('/videos')) return new Response(`{"videoId":"${id}","unrelated":{"title":{"runs":[{"text":"Keyboard shortcuts"}]}}}`);
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/oembed');
    assert.equal(parsed.searchParams.get('url'), `https://www.youtube.com/watch?v=${id}`);
    return new Response(JSON.stringify({ title }), { status: metadataStatus });
  };
  const video = await fetchLatestYoutubeVideo();
  assert.equal(video.id, id);
  assert.equal(video.title, title);
  assert.ok(!video.title.includes('Keyboard shortcuts'));
  metadataStatus = 503;
  await assert.rejects(fetchLatestYoutubeVideo, /metadata request failed/);
  metadataStatus = 200;
  title = '';
  await assert.rejects(fetchLatestYoutubeVideo, /title missing/);
  globalThis.fetch = async () => new Response('{}');
  await assert.rejects(fetchLatestYoutubeVideo, /video ID/);
  console.log('PASS: exact-video metadata, unrelated page title ignored, missing titles and upstream errors rejected');
} finally {
  globalThis.fetch = originalFetch;
}
