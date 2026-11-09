# Anonymous Instagram collector (experimental)

This is an isolated test, NOT the site's production feed. No Instagram login,
access token, imported cookies, paid proxy, or scraping service is used.
The browser may receive normal anonymous cookies during a visit; these are
discarded when it closes. It never opens the user's Chrome profile.

## Findings and actual test results

Public scrapers read HTML, embedded JSON, and the network responses that supply
the page. A profile URL is an input to that process, not an official public-feed
API. Commercial services maintain their own collection infrastructure; their
accepting a URL alone does not establish exactly how they retrieve it.

Sources:
- https://docs.apify.com/academy/puppeteer-playwright/executing-scripts/collecting-data
- https://playwright.dev/docs/network
- https://apify.com/apify/instagram-post-scraper
- https://instaloader.github.io/troubleshooting.html

On November 9, 2026, a fresh local Chrome retrieved public structured posts from
firelandsunited. The newest extracted post was DdZXZWtRym4, September 17, 2026,
caption: "Great save, my man" (with a goalkeeper emoji). Image and video URLs
were present. Opening six visible public post links still yielded only four
validated candidates and the same newest date.

The existing live feed contained DeX4UiRgrCJ dated October 11, 2026.
The rebuilt collector discovered that post through visible profile links, but
the original parser rejected it: Andrew owns it and Firelands is explicitly
listed in coauthor_producers. The parser now accepts confirmed coauthors, not
mere mentions or tags, and preserves the original author separately.

The subsequent anonymous local Chrome test SUCCEEDED: eight validated candidates,
DeX4UiRgrCJ selected, caption and timestamp extracted, and its 4032x3024 JPEG
downloaded and verified. The direct mobile profile endpoint returned HTTP 404;
the successful method read structured data from public Posts/Reels and up to
eight observed post links. No personal login or paid proxy was used.

The collector rejects results older than the known October 11 date and refuses
to regress a previously saved snapshot. Matching the existing feed does not
independently prove that no newer posts exist. Five automated tests pass,
including coauthor acceptance, unrelated-account rejection and failure fallback.

No twice-daily schedule or production switch has been enabled. The manual GitHub
workflow is provided for a separate cloud-host test after these files are pushed;
it has not been run. Cloud anonymous requests can be less reliable than local
requests, as Instaloader's documentation notes.

## Run

From this directory:

```sh
npm ci
npm test
CHROME_CHANNEL=chrome npm run collect
```

Without installed Chrome, run `npx playwright install chromium` and omit
CHROME_CHANNEL. The test uses a fresh browser, blocks image/video/font rendering,
and inspects at most eight visible post links. It sorts by publication date rather
than grid placement so pinned posts don't automatically win.

Successful results are saved to ignored `output/feed.json`, with local media in
`output/media/`. Media downloads validate HTTPS hosts, MIME type, file signatures
and size (5 MB images, 40 MB video). The feed is replaced only after downloads
succeed. Failures leave the previous feed untouched. A failed first run has no
fallback. Partial media files can remain after failure, but are not published.

INSTAGRAM_OUTPUT can specify another directory. INSTAGRAM_MINIMUM_TIMESTAMP can
raise the known-post watermark. Do not lower it to publish incomplete results.
Relative media links must be resolved against the feed URL during eventual site
integration. A video post without a supplied video URL retains its thumbnail.

This does not bypass login walls or challenges. Post data formats may change;
unit tests validate the parser and storage safeguards, not Instagram availability.
Before production use, independently verify freshness, test on the intended
always-on host, seed a persistent fallback, and adapt the site renderer. Only
then enable two checks per day. The existing RSS.app feed is unchanged.
