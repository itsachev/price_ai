# PriceAI progress log

## 2026-09-24

- Added `CLAUDE.md`. It covers the product brief, the stack, the scraper architecture and the target layout from the scraper README, which is not built yet.
- Added this progress log and a rule in `CLAUDE.md` to update it after every change.
- Open: the Next.js app is not set up yet (no `package.json`, `src/`, `scripts/` or `supabase/`).
- Open: `kammarket.js` has a scraper, but KAM Market is missing from `markets_information.md`.

## 2026-09-24: Frontend setup

- Set up Next.js 16.3.6 with JavaScript, the App Router, `src/`, ESLint and no Tailwind. Scaffolded in a temporary folder and copied in, because `create-next-app` refuses a folder that isn't empty.
- Installed `@supabase/supabase-js`, `@supabase/ssr`, `gsap`, `@gsap/react` and `lenis`.
- i18n: all routes are under `src/app/[lang]/`. `src/proxy.js` redirects to a locale based on `Accept-Language`, defaulting to `bg`. Strings are in `dictionaries/en.json` and `dictionaries/bg.json`. `/en` and `/bg` are pre-rendered at build time.
- Added `src/lib/config.js` (`COMPETITORS`, `LOCALES`, `PRICE_STATUSES`) and `src/lib/format.js` (`formatPrice`, EUR only).
- Added `src/components/SmoothScroll.js`: Lenis runs on GSAP's ticker and feeds ScrollTrigger. Smooth scrolling is turned off when the user prefers reduced motion.
- `globals.css` has CSS variables for colors, spacing and type, with light and dark themes, fluid spacing and type, and 44px touch targets. The layout has a sticky header with an EN/BG switch. The dashboard page is a placeholder showing the four price-status badges.
- Checked: `npm run lint` and `npm run build` pass. Visiting `/` redirects to `/en` or `/bg` depending on `Accept-Language`, and `/bg` renders the Bulgarian text.
- Open: Supabase client helpers and auth, the dashboard's real data, the products and competitors pages, and a test runner.

## 2026-09-24: Homepage

- `/[lang]` is now a landing page: hero with an example price-comparison card, "How it works" (collect, match, label), the four price statuses, the tracked chains (from `COMPETITORS`) and a closing call to action.
- Moved the dashboard placeholder to `src/app/[lang]/dashboard/page.js` and added a Dashboard link to the header.
- Added `src/components/Reveal.js`: fades `[data-reveal]` elements in with GSAP `ScrollTrigger.batch`, and skips it for reduced motion. Lenis now handles `#anchor` links with an offset for the sticky header.
- Added `home` strings to `en.json` and `bg.json`, and the `--on-accent`, `--space-4`, `--text-h2` and `--text-lead` tokens to `globals.css`.
- `CLAUDE.md`: no headless browsers or browser debugging unless the user asks.
- Checked: `npm run lint` and `npm run build` pass. Not checked in a browser.
- Open: the preview card uses made-up example prices, and the language switch always goes to the homepage, even from the dashboard.

## 2026-09-24: Data sources research

- Researched price sources and read the KZP data submission spec (PDF) and all the scrapers. No code changed.
- Added `project files/data_sources_research.md` with the legal basis, the KZP data format, promotion sources, full-catalog options, market changes, problems in the current scrapers and next steps.
- Updated `markets_information.md` (added KAM Market and the €25M threshold note; Carrefour has returned), added a known-issues note to the top of `scrapers/README.md`, and added the out-of-scope and research lines in `CLAUDE.md`.
- Open: download a real KZP ZIP to check which chains are in it, the category codes and how much prices vary between stores; then design the schema (stores, dated per-store prices, category codes, promo end dates, no cascade that deletes history) before building the migrations.
- Open: the scraper bugs (pruning deletes history, Kaufland IDs change weekly, stores collapsed at random, cron runs before the 07:00 deadline).

## 2026-09-24: KZP ZIP check

- Downloaded `kolkostruva.bg/opendata_files/2026-09-23.zip` (75 CSVs, ~1.03M rows) and analysed it with throwaway scripts in the scratchpad. No app code changed.
- Wrote the results to the "Real ZIP check" section of `data_sources_research.md`.
- Found: CBA's EIK is missing from the ZIP (`cba.js` will fail); Carrefour/Parkmart is missing; Lidl's CSV has broken quoting, so `parseCsv` loses about half its rows; 3 files use `;` as the delimiter; 3 use decimal commas; only BILLA, МИНИМАРТ and Hit Max vary much in price between stores; chains send 700–2,900 codes, well beyond the basket.
- Open: fix `parseCsv` (lenient quotes, detect `;`) and decimal-comma parsing; decide what to do about CBA; source Kaufland and Lidl from the ZIP; then design the schema.

## 2026-09-24: Dropped CBA

- CBA is out of scope: its EIK (`202420609`) is no longer in the KZP ZIP and it has no other feed.
- Deleted `project files/scrapers/cba.js` and removed CBA from `scrapers/index.js`, `COMPETITORS` in `src/lib/config.js`, `markets_information.md`, `scrapers/README.md` and `CLAUDE.md` (it's now listed as out of scope).
- Open: a `competitors` row for `cba` must not be seeded when the migrations are built.
