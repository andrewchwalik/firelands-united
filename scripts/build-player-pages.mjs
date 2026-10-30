import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');
const escape = (value) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const keys = ['appearances', 'goals', 'assists', 'saves', 'yellowCards', 'redCards'];
const labels = ['Appearances', 'Goals', 'Assists', 'Saves', 'Yellow cards', 'Red cards'];

export const statKeysForPosition = (position = '') =>
  keys.filter(key => key !== 'saves' || /\b(GK|goalkeeper|keeper)\b/i.test(position));

function awardIcon(category) {
  const shapes = {
    league: '<path d="M7 3h10v5a5 5 0 0 1-10 0V3Zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 13v6m-4 2h8m-6-2h4"/>',
    offensive: '<path d="m7 3 5 6 5-6M9 3l3 4 3-4"/><circle cx="12" cy="15" r="6"/><path d="m12 11 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4Z"/>',
    match: '<path d="m12 2 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 8.4l6.1-.9ZM8 22h8"/>'
  };
  return `<svg class="profile-award-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[category] || shapes.league}</svg>`;
}

export function renderMatches(profile, player, seasons, matches) {
  const selected = (profile.matchIds || []).map(id => {
    const match = matches.find(m => m.id === id && m.team === player.team);
    if (!match || !Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore)) throw new Error(`Invalid profile match: ${id}`);
    return match;
  });
  const years = [...new Set(selected.map(m => m.season))].sort((a, b) => b - a);
  const groups = years.map(year => {
    const season = seasons.find(s => s.team === player.team && s.season === year);
    if (!season?.league) throw new Error(`Missing league for ${player.id}, ${year}`);
    const cards = selected.filter(m => m.season === year).map(m => {
      const contributions = keys.filter(k => k !== 'appearances' && (m.playerEvents?.[k]?.[player.id] || 0) > 0)
        .map(k => {
          const count = m.playerEvents[k][player.id];
          const label = labels[keys.indexOf(k)].toLowerCase();
          return `${count} ${count === 1 ? label.replace(/s$/, '') : label}`;
        });
      const date = /^\d{4}-\d{2}-\d{2}$/.test(m.date) ? new Date(`${m.date}T12:00:00Z`).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}) : 'Date not recorded';
      return `<li class="profile-match"><p class="profile-match-meta">${escape(date)} &middot; ${escape(m.competition)}</p><div class="profile-match-score"><span>${escape(m.homeTeam)}</span><strong aria-label="${m.homeScore} to ${m.awayScore}">${m.homeScore}&ndash;${m.awayScore}</strong><span>${escape(m.awayTeam)}</span></div><p class="profile-match-contributions">${contributions.length ? escape(contributions.join(' / ')) : 'Individual contributions not recorded.'}</p></li>`;
    }).join('');
    return `<div class="profile-match-season"><h3>${year} <span>${escape(season.league)}</span></h3><ul class="profile-match-list">${cards}</ul></div>`;
  }).join('');
  return `<section class="profile-season profile-matches" aria-labelledby="matches-title"><div class="profile-section-heading"><h2 id="matches-title">Matches</h2></div><p class="profile-note">${escape(profile.matchRecordNote || 'Final scores and individual contributions from recorded player appearances.')}</p>${groups || '<p>Individual match appearances have not been recorded yet.</p>'}</section>`;
}

export function renderHonors(profile) {
  const awards = profile.awards || [];
  const superlatives = profile.superlatives || [];
  if (!awards.length && !superlatives.length) return '';
  const awardCards = awards.length ? `<ul class="profile-awards-grid">${awards.map(award =>
    `<li class="profile-award">${awardIcon(award.category)}<div>${award.season ? `<p class="profile-award-year">${escape(award.season)}</p>` : ''}<h3>${escape(award.title)}</h3></div></li>`
  ).join('')}</ul>` : '';
  const votes = superlatives.length ? `<div class="profile-superlatives"><h3>Superlatives</h3><ul>${superlatives.map(vote =>
    `<li><span class="profile-award-year">${escape(vote.season)}</span><span>${escape(vote.title)}</span></li>`
  ).join('')}</ul></div>` : '';
  return `<section class="profile-season profile-honors" aria-labelledby="honors-title"><div class="profile-section-heading"><h2 id="honors-title">Awards &amp; honors</h2></div>${awardCards}${votes}</section>`;
}

// Publish another player by adding their bio to player-profiles.json and their
// profileUrl to players.json. The regular build-stats command rebuilds profiles.
export async function buildPlayerPages() {
  const { players } = JSON.parse(await read('data/players.json'));
  const { seasons } = JSON.parse(await read('data/season-stats.json'));
  const { profiles } = JSON.parse(await read('data/player-profiles.json'));
  const { matches } = JSON.parse(await read('data/matches.json'));
  const template = await read('_templates/player-profile.html');
  for (const profile of profiles) {
    const player = players.find(p => p.id === profile.id);
    if (!player) throw new Error(`Unknown player profile: ${profile.id}`);
    const displayedKeys = statKeysForPosition(player.roster?.position);
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
      honors: renderHonors(profile),
      matches: renderMatches(profile, player, seasons, matches),
      cutoutClass: profile.cutout ? ' profile-hero-with-cutout' : '',
      cutout: profile.cutout ? `<div class="profile-cutout" aria-hidden="true"><img src="${escape(profile.cutout)}" alt="" width="1080" height="1350" fetchpriority="high"></div>` : `<img class="profile-art-fallback" src="${escape(player.image)}" alt="${escape(player.name)}" width="500" height="500">`,
      statHeaders: displayedKeys.map(k => `<th scope="col">${k === 'appearances' ? 'Apps' : labels[keys.indexOf(k)]}</th>`).join(''),
      rows: rows.map(r => `<tr><th scope="row">${r.year}</th><td>${escape(r.league)}</td>${displayedKeys.map(k => `<td>${r[k]}</td>`).join('')}</tr>`).join(''),
      totalCells: displayedKeys.map(k => `<td>${totals[k]}</td>`).join(''),
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
