import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const keys = ['appearances', 'goals', 'assists', 'saves', 'yellowCards', 'redCards'];
const labels = ['Appearances', 'Goals', 'Assists', 'Saves', 'Yellow cards', 'Red cards'];

// Publish another player by adding their bio to player-profiles.json and their
// profileUrl to players.json. The regular build-stats command rebuilds profiles.
export async function buildPlayerPages() {
  const { players } = JSON.parse(await read('data/players.json'));
  const { seasons } = JSON.parse(await read('data/season-stats.json'));
  const { profiles } = JSON.parse(await read('data/player-profiles.json'));
  const template = await read('_templates/player-profile.html');
  for (const profile of profiles) {
    const player = players.find(p => p.id === profile.id);
    if (!player) throw new Error(`Unknown player profile: ${profile.id}`);
    const rows = seasons.filter(s => s.team === player.team && s.playerStats[player.id])
      .sort((a, b) => b.season - a.season)
      .map(s => ({ year: s.season, league: s.league, ...Object.fromEntries(keys.map(k => [k, s.playerStats[player.id][k] ?? 0])) }));
    if (!rows.length) throw new Error(`No season records for ${player.id}`);
    const totals = Object.fromEntries(keys.map(k => [k, rows.reduce((sum, row) => sum + row[k], 0)]));
    const statCards = (stats, fields) => fields.map(k => `<div class="profile-stat"><strong>${stats[k]}</strong><span>${labels[keys.indexOf(k)]}</span></div>`).join('');
    const values = {
      name: escape(player.name), firstName: escape(player.name.split(' ')[0]), lastName: escape(player.name.split(' ').slice(1).join(' ')),
      id: player.id, image: escape(player.image), number: escape(player.roster.number), position: escape(player.roster.position),
      hometown: escape(player.hometown || 'Not listed'), team: player.team === 'women' ? "Women's First Team" : "Men's First Team",
      rosterUrl: player.team === 'women' ? '/womens-roster/' : '/mens-roster/',
      bio: escape(profile.bio), seasonTenure: `${rows.length} ${rows.length === 1 ? 'Season' : 'Seasons'} with Firelands United`,
      measurements: [profile.height && `<span>Height: ${escape(profile.height)}</span>`, profile.weight && `<span>Weight: ${escape(profile.weight)}</span>`].filter(Boolean).join(''),
      totalCards: statCards(totals, ['appearances', 'goals', 'assists']),
      rows: rows.map(r => `<tr><th scope="row">${r.year}</th>${keys.map(k => `<td>${r[k]}</td>`).join('')}</tr>`).join(''),
      totalCells: keys.map(k => `<td>${totals[k]}</td>`).join(''),
      contribution: totals.goals + totals.assists,
      rate: totals.appearances ? (totals.goals / totals.appearances).toFixed(2) : '0.00'
    };
    const html = template.replace(/{{(\w+)}}/g, (_, key) => {
      if (!(key in values)) throw new Error(`Unknown placeholder ${key}`);
      return values[key];
    });
    const dir = path.join(root, 'players', player.id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), html);
    console.log(`Built /players/${player.id}/`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPlayerPages();
}
