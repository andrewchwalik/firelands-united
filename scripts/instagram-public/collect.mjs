import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { extractPosts } from './extract.mjs';
import { saveSnapshot } from './save.mjs';

const username = 'firelandsunited';
const output = resolve(process.env.INSTAGRAM_OUTPUT || new URL('./output', import.meta.url).pathname);
const diagnostics = { methods: [], candidates: [] };
const posts = new Map();
const seen = new Set();
const ingest = data => {
  for (const post of extractPosts(data, username)) {
    const existing = posts.get(post.shortcode);
    if (!existing || post.video_url || !existing.video_url) posts.set(post.shortcode, post);
  }
  // Record only public post identifiers and field names, never session payloads.
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    const code = value.shortcode || value.code;
    if (typeof code === 'string' && (value.taken_at || value.taken_at_timestamp) && !seen.has(code)) {
      seen.add(code);
      diagnostics.candidates.push({ code, owner: value.owner?.username || value.user?.username,
        timestamp: value.taken_at || value.taken_at_timestamp, fields: Object.keys(value),
        coauthors: value.coauthor_producers?.map(user => user.username) });
    }
    for (const child of Object.values(value)) if (typeof child === 'object') walk(child);
  };
  walk(data);
};
let browser;
try {
  const direct = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
    headers: { 'X-IG-App-ID': '936619743392459', 'User-Agent': 'Mozilla/5.0', Accept: '*/*' },
    signal: AbortSignal.timeout(20000), redirect: 'error'
  }).catch(() => null);
  diagnostics.methods.push({ method: 'direct-profile', status: direct?.status || 'network-error' });
  if (direct?.ok && direct.headers.get('content-type')?.includes('json')) ingest(await direct.json());

  browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || undefined, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pending = new Set();
  await context.route('**/*', route => ['image', 'media', 'font'].includes(route.request().resourceType())
    ? route.abort() : route.continue());
  page.on('response', response => {
    if (!/(^|\.)instagram\.com$/.test(new URL(response.url()).hostname) || !response.headers()['content-type']?.includes('json')) return;
    const task = response.json().then(ingest).catch(() => {});
    pending.add(task);
    task.finally(() => pending.delete(task));
  });
  async function inspect(url, scroll = false) {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    diagnostics.methods.push({ method: new URL(url).pathname, status: response?.status() });
    if (/\/accounts\/login|\/challenge\//.test(page.url()) || [401,403,429].includes(response?.status())) {
      throw new Error('Instagram requires login, a challenge, or has restricted this request.');
    }
    await page.waitForTimeout(5000);
    if (scroll) {
      // Two bounded scrolls allow lazy-loaded grid data without an unbounded crawl.
      for (let i = 0; i < 2; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(1500); }
    }
    for (const raw of await page.locator('script[type="application/json"]').allTextContents()) {
      try { ingest(JSON.parse(raw)); } catch {}
    }
    await Promise.all([...pending]);
    return page.locator('a[href]').evaluateAll(nodes => [...new Set(nodes.map(n => n.href))]
      .filter(url => /^https:\/\/www\.instagram\.com\/(?:[^/]+\/)?(?:p|reel)\/[\w-]+\/?$/.test(url)));
  }
  const links = new Set();
  for (const path of ['', 'reels/']) {
    for (const link of await inspect(`https://www.instagram.com/${username}/${path}`, true)) links.add(link);
  }
  for (const link of [...links].slice(0, 8)) await inspect(link);
  const latest = [...posts.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  diagnostics.accepted = [...posts.values()].map(({ permalink, timestamp }) => ({ permalink, timestamp }));
  if (!latest) throw new Error('No verified public posts received.');
  const minimumTimestamp = process.env.INSTAGRAM_MINIMUM_TIMESTAMP || '2026-10-11T23:52:22.000Z';
  if (!Number.isFinite(Date.parse(minimumTimestamp))) throw new Error('Invalid minimum timestamp.');
  if (Date.parse(latest.timestamp) < Date.parse(minimumTimestamp)) {
    throw new Error(`Incomplete public feed: newest retrieved post is ${latest.timestamp}, older than known post ${minimumTimestamp}.`);
  }
  await saveSnapshot(output, latest);
  console.log(JSON.stringify({ status: 'success', permalink: latest.permalink, timestamp: latest.timestamp, candidates: posts.size, output }));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', reason: error.message, preservedPreviousFeed: true }));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n');
}
