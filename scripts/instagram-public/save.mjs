import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { validMedia } from './extract.mjs';

export async function saveSnapshot(output, post, fetchMedia = fetch) {
  let previous;
  try { previous = JSON.parse(await readFile(resolve(output, 'feed.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous?.posts?.[0]?.timestamp > post.timestamp) throw new Error('Refusing to replace a newer saved post with an older result.');
  await mkdir(resolve(output, 'media'), { recursive: true });
  const download = async (url, video = false) => {
    if (!validMedia(url)) throw new Error('Invalid media host.');
    const response = await fetchMedia(url, { redirect: 'error', signal: AbortSignal.timeout(45000) });
    const mime = response.headers.get('content-type')?.split(';')[0];
    const types = video ? { 'video/mp4': 'mp4' } : { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!response.ok || !types[mime]) throw new Error('Media download failed or unexpected media format.');
    const limit = video ? 40 * 1024 * 1024 : 5 * 1024 * 1024;
    let size = 0;
    const parts = [];
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > limit) throw new Error('Media exceeds size limit.');
      parts.push(chunk);
    }
    const bytes = Buffer.concat(parts);
    const signatures = {
      jpg: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      png: bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
      webp: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
      mp4: bytes.toString('ascii', 4, 8) === 'ftyp'
    };
    if (!signatures[types[mime]]) throw new Error('Media signature does not match its format.');
    const file = `media/${createHash('sha256').update(bytes).digest('hex').slice(0, 20)}.${types[mime]}`;
    await writeFile(resolve(output, file), bytes);
    return `./${file}`;
  };
  const image = await download(post.image_url);
  const video = post.video_url ? await download(post.video_url, true) : null;
  const snapshot = { profile: { username: post.username }, posts: [{ ...post, image_url: image, video_url: video }], updated_at: new Date().toISOString() };
  await writeFile(resolve(output, 'feed.json.tmp'), JSON.stringify(snapshot, null, 2) + '\n');
  await rename(resolve(output, 'feed.json.tmp'), resolve(output, 'feed.json'));
}
