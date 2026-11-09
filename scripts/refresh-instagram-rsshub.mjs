import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const worker = await readFile(new URL('../workers/instagram-rsshub.js', import.meta.url), 'utf8');
const { normalize } = await import(`data:text/javascript;base64,${Buffer.from(worker).toString('base64')}`);
const MAX_BYTES = 5 * 1024 * 1024;

async function download(url, accept) {
  const response = await fetch(url, {
    redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { Accept: accept }
  });
  if (!response.ok) throw new Error(`RSSHub or image request failed (HTTP ${response.status})`);
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('Response exceeds 5 MB');
    chunks.push(chunk);
  }
  return { bytes: Buffer.concat(chunks), type: response.headers.get('content-type')?.split(';')[0] };
}

async function image(source) {
  const { bytes, type } = await download(source, 'image/*');
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const extension = extensions[type];
  const valid = (extension === 'jpg' && bytes[0] === 0xff && bytes[1] === 0xd8)
    || (extension === 'png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    || (extension === 'webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
  if (!valid) throw new Error('Image response is not a supported image');
  const name = `${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
  return { name, bytes, url: `/data/instagram/${name}` };
}

export async function refresh({ endpoint = 'http://127.0.0.1:1200/instagram/user/firelandsunited?format=json', output = 'data/instagram' } = {}) {
  const url = new URL(endpoint);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:') {
    throw new Error('This job must use its local RSSHub instance');
  }
  const { bytes } = await download(url, 'application/feed+json, application/json');
  const data = JSON.parse(bytes.toString('utf8'));
  if (data.home_page_url && !/^https:\/\/(www\.)?instagram\.com\/firelandsunited\/?$/.test(data.home_page_url)) {
    throw new Error('Feed belongs to a different Instagram profile');
  }
  const normalized = normalize(data);
  const { source_image, ...post } = normalized.posts[0];
  const assets = [await image(source_image)];
  let previous;
  try { previous = JSON.parse(await readFile(resolve(output, 'feed.json'), 'utf8')); } catch { /* First successful refresh. */ }
  let avatar = previous?.profile?.profile_picture_url || '/img/firelands-badge.png';
  if (normalized.avatar) {
    try {
      const saved = await image(normalized.avatar);
      assets.push(saved);
      avatar = saved.url;
    } catch { console.warn('Profile image unavailable; retaining the saved avatar.'); }
  }
  const snapshot = {
    posts: [{ ...post, image_url: assets[0].url }],
    profile: { username: 'firelandsunited', profile_picture_url: avatar },
    source: 'rsshub', updated_at: new Date().toISOString()
  };
  // No writes occur until the feed and latest post image have passed validation.
  await mkdir(output, { recursive: true });
  for (const asset of assets) await writeFile(resolve(output, asset.name), asset.bytes);
  await writeFile(resolve(output, 'feed.json.tmp'), JSON.stringify(snapshot, null, 2) + '\n');
  await rename(resolve(output, 'feed.json.tmp'), resolve(output, 'feed.json'));
  console.log(`Saved Instagram post ${post.id} and ${assets.length} image(s).`);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  refresh().catch(error => { console.error(error.message); process.exitCode = 1; });
}
