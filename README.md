# Crease

A free daily folding puzzle. Static site, no backend, no dependencies.

## What gets built
`node build.js` writes `dist/`:
- `index.html` the game, plus FAQ and about text for search engines
- `archive/` every past puzzle, playable by date (`/?d=YYYY-MM-DD`)
- `answers/N.html` hints and full solutions, published two days after each puzzle
- `how-to-play.html` rules and strategy, `about.html`, `privacy.html`
- `sitemap.xml`, `robots.txt`, `feed.xml` (RSS), `manifest.webmanifest` and `sw.js` (installable, works offline)
- share image and icons from `assets/`

Puzzle number 1 is 2026-10-24. To change the launch date, edit `MIN_DATE` and the `Date.UTC(2026, 9, 24 ...)` expressions in `src/logic.js`.

## Deploy (free, hands-off)
1. Create a GitHub repo, push this folder to `main`.
2. Repo Settings, Pages: set Source to "GitHub Actions".
3. Repo Settings, Secrets and variables, Actions, Variables: add `SITE_URL` (for example `https://yourname.github.io/crease`, no trailing slash).
4. The workflow in `.github/workflows/deploy.yml` redeploys daily at 00:10 UTC.

A site at the root of its own domain (a free `*.pages.dev` from Cloudflare Pages, or a custom domain) is better for search than a `/crease` subpath, because `robots.txt` and the sitemap only work at the root. On Cloudflare Pages use build command `node build.js` and output folder `dist`, and add a daily deploy hook trigger.

## Optional variables (all free to set later)
- `CF_BEACON_TOKEN`: Cloudflare Web Analytics token. Cookie-free visit counts.
- `ADSENSE_CLIENT`: your `ca-pub-...` id once Google approves the site. Adds auto ads and `ads.txt`.
- `CONTACT_EMAIL`: shown on About and Privacy (ad networks expect a contact).

## Tests
- `node tools/check-links.js` checks every link and sitemap entry in `dist/`.
- `tools/make-assets.js` re-renders icons and the share image (needs Playwright).
