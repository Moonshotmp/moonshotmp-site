# moonshotmp-site

Public marketing site for Moonshot Medical and Performance (https://moonshotmp.com), plus the partner storefront under `/partners/`.

- Hosting: Netlify, static. `netlify.toml` publishes the repo root (`publish = "."`), so every tracked file is servable unless `_redirects` blocks it.
- Deploys: merging to `main` auto-deploys. There is no CI; run the tests locally before opening a PR.
- Pages: one `index.html` per URL directory (`/medical/`, `/learn/<slug>/`, `/rehab/`, `/quiz/<name>/`, ...). Shared header, footer and scripts live in `shared/`.
- Functions: `netlify/functions/` (quiz submissions, lead magnets, quiz-event analytics, Stripe webhooks), served at `/.netlify/functions/<name>`. Edge functions live in `netlify/edge-functions/`.
- Redirects: `_redirects` holds every redirect. Its top block force-404s repo internals (`/netlify/*`, `/tests/*`, `/src/*`, `/scripts/*`, `package.json`, lock files, configs, this README) so they are never served from the publish root. Keep new internal paths in that block.
- Tests: `npm test` (Vitest, watch mode) or `npm run test:run` (one shot). Tests live in `tests/` and cover the quiz scoring, antispam and geo helpers.
- No em dashes (owner rule): served and sent text carries no U+2014 em dash or its HTML entity; `tests/no-em-dashes.test.js` fails with file:line on any.
- `node scripts/strip-em-dashes.mjs [--report <path>] [files...]` rewrites them with context-aware punctuation (comma, colon, full stop, middot, pipe in titles) and logs each change; re-read what it changes in headings, CTAs and emails.
- Sitemap: `sitemap.xml` is hand-maintained. After committing page changes, run `node scripts/sitemap-lastmod.mjs` to reset every `<lastmod>` to the page's last commit date (`--check` exits 1 when any entry is stale or points at a missing file). Add the SHA of any site-wide boilerplate commit (footer, header) to `scripts/sitemap-lastmod-ignore.txt` so it does not reset every date.
- Robots and AI crawlers: `robots.txt` and `llms.txt` at the root.
- Security headers: `_headers`.
- 404: `404.html`, served by the catch-all at the bottom of `_redirects`.

## CSS build

`shared/tailwind.css` is compiled from `src/input.css` by Tailwind v4 (`@tailwindcss/cli`, pinned in `package.json`). Netlify runs `npm ci && npm run build:css` on every deploy, so a class added to any page or to the markup strings in `shared/*.js` gets its rule without a manual step; the compiled file is also committed so the site stays correct if the build step ever regresses. Locally: `npm run build:css` (or `npm run watch:css`), then `npm run check:css` to list used classes that have no rule.
