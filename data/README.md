# Firelands United Data

This folder is the repo-backed stats database for the site. It keeps the source data in small files so roster, season stats, records, standings, and future pages can all point at the same information.

## Files

- `players.json`: player identity, roster card info, images, and current roster flags.
- `staff.json`: staff identity, roles, images, and coached match totals.
- `season-stats.json`: player and team totals by team and season.
- `matches.json`: match results, competition, links, and known per-match stat notes.
- `standings.json`: current league tables used on the home page.
- `generated/club-stats.json`: generated all-time summaries and records. Do not edit this by hand.

## Match Update Flow

1. Add the result to `matches.json`.
2. Update player totals in `season-stats.json`.
3. Update coached match totals in `staff.json`.
4. Update `standings.json` when the league table changes.
5. Run `node scripts/build-stats.mjs`.

The static HTML pages still need to be wired to this data in a later pass. For now, this folder gives the club one structured place to maintain stats and calculate records.
