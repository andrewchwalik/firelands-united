# Free RSSHub trial: not activated

The isolated `codex/rsshub-instagram` branch runs RSSHub temporarily on a
GitHub-hosted runner. The live contact page and RSS.app Worker are unchanged.

## Real test result (November 9, 2026)

Run: https://github.com/andrewchwalik/firelands-united/actions/runs/42674936836

Both automated tests passed and RSSHub started successfully. The request to
`/instagram/user/firelandsunited?format=json` returned HTTP 503 with:

    ConfigNotFoundError: Please set `INSTAGRAM_COOKIE`

No real feed snapshot was produced or published. This trial does not establish
a working anonymous Instagram feed. A login cookie is a sensitive credential,
can expire, and must never be committed or pasted into public workflow logs.
Do not activate this workflow on main until the authentication tradeoff is
approved and real post/image retrieval has been verified.

## Intended behavior if retrieval becomes viable

- Twice-daily runs save the latest post and downloaded images to
  `data/instagram/`, retaining the previous success on retrieval failure.
- Branch tests only create preview artifacts; they never publish to the site.
- Main-branch scheduled runs can commit snapshots and request a Pages build.
- The frontend must be explicitly switched to the saved feed after validation.
- GitHub schedules can be delayed and public-repository scheduled workflows
  can be disabled after 60 days of inactivity. This is not a guaranteed service.
- Pin the tested RSSHub image digest before adopting it for production.

Local checks:

    node scripts/test-instagram-rsshub.mjs
    node scripts/test-refresh-instagram-rsshub.mjs

The Worker and Docker Compose alternatives in `workers/rsshub/` are separate
staged prototypes, not deployed services.
