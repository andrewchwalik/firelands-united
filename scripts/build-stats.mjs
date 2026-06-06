import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const dataDir = path.join(root, "data");

const statKeys = [
  "appearances",
  "goals",
  "assists",
  "saves",
  "yellowCards",
  "redCards"
];

const readJson = async (fileName) => {
  const raw = await readFile(path.join(dataDir, fileName), "utf8");
  return JSON.parse(raw);
};

const increment = (target, key, amount = 0) => {
  if (!amount) return;
  target[key] = (target[key] || 0) + amount;
};

const sortLeaders = (entries, key) =>
  entries
    .filter((entry) => entry[key] > 0)
    .sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name));

const leadersFor = (entries) =>
  Object.fromEntries(statKeys.map((key) => [key, sortLeaders(entries, key)]));

const main = async () => {
  const [{ players }, { staff }, { seasons }, { matches }, { standings }] = await Promise.all([
    readJson("players.json"),
    readJson("staff.json"),
    readJson("season-stats.json"),
    readJson("matches.json"),
    readJson("standings.json")
  ]);

  const people = new Map();
  for (const player of players) {
    people.set(player.id, { ...player, kind: "player" });
  }
  for (const person of staff) {
    if (!people.has(person.id)) {
      people.set(person.id, { ...person, kind: "staff" });
    }
  }

  const missingRefs = [];
  for (const season of seasons) {
    for (const playerId of Object.keys(season.playerStats || {})) {
      if (!people.has(playerId)) {
        missingRefs.push(`season-stats:${season.team}:${season.season}:${playerId}`);
      }
    }
  }
  for (const match of matches) {
    for (const statGroup of Object.values(match.playerEvents || {})) {
      for (const playerId of Object.keys(statGroup)) {
        if (!people.has(playerId)) {
          missingRefs.push(`matches:${match.id}:${playerId}`);
        }
      }
    }
  }
  if (missingRefs.length) {
    throw new Error(`Unknown people referenced:\n${missingRefs.join("\n")}`);
  }

  const allTime = {};
  const bySeason = {};

  for (const season of seasons) {
    const seasonKey = `${season.team}-${season.season}`;
    const seasonEntries = [];

    for (const [playerId, stats] of Object.entries(season.playerStats || {})) {
      const person = people.get(playerId);
      const entry = {
        id: playerId,
        name: person.name,
        team: season.team,
        season: season.season
      };
      for (const key of statKeys) {
        entry[key] = stats[key] || 0;
      }
      seasonEntries.push(entry);

      allTime[playerId] ||= {
        id: playerId,
        name: person.name,
        team: person.team || season.team,
        seasons: []
      };
      allTime[playerId].seasons.push(season.season);
      for (const key of statKeys) {
        increment(allTime[playerId], key, stats[key]);
      }
    }

    bySeason[seasonKey] = {
      team: season.team,
      season: season.season,
      league: season.league,
      tableFinish: season.tableFinish,
      record: season.record,
      teamTotals: season.teamTotals,
      leaders: leadersFor(seasonEntries)
    };
  }

  const allTimeEntries = Object.values(allTime).map((entry) => ({
    ...entry,
    seasons: [...new Set(entry.seasons)].sort()
  }));

  const staffTotals = staff.map((person) => ({
    id: person.id,
    name: person.name,
    roles: person.roles,
    matchesCoached: person.roles.reduce((total, role) => total + (role.matchesCoached || 0), 0)
  }));

  const output = {
    generatedBy: "scripts/build-stats.mjs",
    sourceFiles: [
      "data/players.json",
      "data/staff.json",
      "data/season-stats.json",
      "data/matches.json",
      "data/standings.json"
    ],
    counts: {
      players: players.length,
      staff: staff.length,
      seasons: seasons.length,
      matches: matches.length,
      standings: standings.length
    },
    leaders: {
      allTime: leadersFor(allTimeEntries),
      bySeason
    },
    staffTotals,
    standings
  };

  const outputDir = path.join(dataDir, "generated");
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "club-stats.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );

  console.log(
    `Generated data/generated/club-stats.json from ${players.length} players, ${seasons.length} seasons, and ${matches.length} matches.`
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
