# moonshotmp-site
Moonshot Medical &amp; Performance website + partner portal

## CSS build

`shared/tailwind.css` is compiled from `src/input.css` by Tailwind v4 (`@tailwindcss/cli`, pinned in `package.json`). Netlify runs `npm ci && npm run build:css` on every deploy, so a class added to any page or to the markup strings in `shared/*.js` gets its rule without a manual step; the compiled file is also committed so the site stays correct if the build step ever regresses. Locally: `npm run build:css` (or `npm run watch:css`), then `npm run check:css` to list used classes that have no rule.
