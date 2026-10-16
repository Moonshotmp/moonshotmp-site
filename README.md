# moonshotmp-site

Public marketing site for Moonshot Medical and Performance (https://moonshotmp.com), plus the partner storefront under `/partners/`.

- Hosting: Netlify, static. `netlify.toml` publishes the repo root (`publish = "."`), so every tracked file is servable unless `_redirects` blocks it.
- Deploys: merging to `main` auto-deploys. There is no CI; run the tests locally before opening a PR.
- Pages: one `index.html` per URL directory (`/medical/`, `/learn/<slug>/`, `/rehab/`, `/quiz/<name>/`, ...). Shared header, footer and scripts live in `shared/`.
- Functions: `netlify/functions/` (quiz submissions, lead magnets, quiz-event analytics, Stripe webhooks), served at `/.netlify/functions/<name>`. Edge functions live in `netlify/edge-functions/`.
- Redirects: `_redirects` holds every redirect. Its top block force-404s repo internals (`/netlify/*`, `/tests/*`, `/src/*`, `/scripts/*`, `package.json`, lock files, configs, this README) so they are never served from the publish root. Keep new internal paths in that block.
- Tests: `npm test` (Vitest, watch mode) or `npm run test:run` (one shot). Tests live in `tests/` and cover the quiz scoring, antispam and geo helpers.
- Sitemap: `sitemap.xml` is hand-maintained. After committing page changes, run `node scripts/sitemap-lastmod.mjs` to reset every `<lastmod>` to the page's last commit date (`--check` exits 1 when any entry is stale or points at a missing file).
- Robots and AI crawlers: `robots.txt` and `llms.txt` at the root.
- Security headers: `_headers`.
- 404: `404.html`, served by the catch-all at the bottom of `_redirects`.
