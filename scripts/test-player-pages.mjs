import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { buildPlayerPages, statKeysForPosition } from './build-player-pages.mjs';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const { players } = JSON.parse(await read('data/players.json'));
const { seasons } = JSON.parse(await read('data/season-stats.json'));
const { profiles } = JSON.parse(await read('data/player-profiles.json'));
assert.ok(statKeysForPosition('GK').includes('saves'));
assert.ok(statKeysForPosition('GK/CB').includes('saves'));
assert.ok(!statKeysForPosition('ST/RW').includes('saves'));
assert.ok(!statKeysForPosition().includes('saves'));
await buildPlayerPages();
for (const profile of profiles) {
  const player = players.find(p => p.id === profile.id);
  const keys = statKeysForPosition(player.roster?.position);
  const file = `players/${profile.id}/index.html`;
  const html = await read(file);
  assert.equal(html.includes('<th scope="col">Saves</th>'), keys.includes('saves'));
  assert.equal(player.profileUrl, `/players/${profile.id}/`);
  assert.ok(!/{{\w+}}/.test(html), 'No unresolved template fields');
  assert.equal((html.match(/<table /g) || []).length, 1, 'One combined season table');
  assert.ok(!html.includes('Season spotlight') && !html.includes('Every season. One club.'));
  assert.ok(html.includes('class="profile-scoring-stats"') || html.includes('profile-career-stats profile-scoring-stats'));
  assert.ok(html.includes('Seasons with Firelands United') || html.includes('Season with Firelands United'));
  if (profile.height) assert.ok(html.includes('Height:'));
  if (profile.weight) assert.ok(html.includes(`Weight: ${profile.weight}`));
  const records = seasons.filter(s => s.team === player.team && s.playerStats[player.id]);
  for (const record of records) {
    const cells = keys.map(key => `<td>${record.playerStats[player.id][key] ?? 0}</td>`).join('');
    assert.ok(html.includes(`<tr><th scope="row">${record.season}</th>${cells}</tr>`), `Season ${record.season} matches source`);
  }
  const totals = keys.map(key => records.reduce((sum, r) => sum + (r.playerStats[player.id][key] ?? 0), 0));
  assert.ok(html.includes(`<tfoot><tr><th scope="row">All time</th>${totals.map(n => `<td>${n}</td>`).join('')}</tr></tfoot>`));
  for (const [, asset] of html.matchAll(/(?:src|href)="(\/(?:img|fonts)\/[^"?]+)"/g)) {
    await access(new URL(asset.slice(1), root));
  }
  await buildPlayerPages();
  assert.equal(await read(file), html, 'Build is deterministic');
  console.log(`PASS ${player.name}: season rows, career totals, profile link, assets and repeat build`);
}
