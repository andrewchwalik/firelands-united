# Firelands Cloudflare migration

Completed live cutover: 2026-11-11. Website commit: d665503.
Source account: cf4f58cbec253b84ccd8e76507ad1f27.
Destination: 882451379435f963fab05affbfafdc3b (hello@firelandsunited.com).
Destination service suffix: firelandsunited.workers.dev.

## Live services

- firelandsunited-contact: all four Discord webhook secrets installed encrypted.
- firelandsunited-cms-auth: matching GitHub client ID and encrypted secret.
- firelandsunited-social-feed: YouTube and Bluesky.
- firelandsunited-instagram-feed: adapter with INSTAGRAM_SOURCE service binding.
- firelands-instagram-candidate: Instagram cache/source with encrypted APIFY_TOKEN.

Storage:
- SUPERLATIVES_KV: 2cb04ead0e6342f4ad27070b000601b2.
- Instagram CACHE: ddd2a24ddebf4119aee8bc3c71ab4378.

GitHub Pages still hosts the website. DNS and email unchanged.
Apify schedule VvdzDQ75Lvl2VHHPM continues twice daily; no duplicate scheduler added.
No plan upgrades, payments, or source resource deletions performed.

## Verification

- All 33 voting key values matched source exactly after import.
- Men's and women's computed totals match the original service.
- Source key list rechecked after old contact forwarding: no additional keys.
- Contact and internship attachment submissions accepted by Discord (HTTP 200).
- Both voting handlers delivered to correct Discord channels using in-memory
  test ballots. No test votes were written to production storage.
- Invalid form rejected (400); CORS preflight succeeds (204).
- New exact GitHub callback added with explicit user approval and no wildcard.
  Old callback retained. New service explicitly supplies redirect_uri.
- Browser OAuth exchange succeeded; published CMS login loaded Blog Posts.
- Published contact page uses new feed URLs and new cached image origin.
- Instagram adapter/media return 200; YouTube and Bluesky both populated.
- Ten Instagram tests pass.
- Desktop browser verified loaded card images and no horizontal overflow.
  Browser viewport override did not take effect, so fresh mobile visual QA
  was not completed. No HTML layout/CSS changes were made.

## Compatibility and rollback

Old contact URL forwards to new contact service so stale open pages do not write
to old storage. Its original KV and secrets are retained. Exact original Worker
download: /tmp/fufc-contact-before-migration.js; original source is also in Git.
Do not restore old contact writes without syncing any new ballots back first.

Old CMS callback and other old services remain as rollback copies.
Historical RSSHub test/cache remain unused in the old account, not migrated.
The site has no intended dependency on those old services after URL propagation.
Do not delete old resources without explicit cleanup approval.

Publishing used /tmp/fufc-migration-publish on codex/firelands-account-migration
to exclude unrelated local changes. Main workspace was not reset or rebased.
Rotate credentials shared in chat in a coordinated follow-up; do not expose
credential values in source or documentation.
