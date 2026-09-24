# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Progress log

After every piece of work that changes the project, append an entry to `project files/app_progress.md`. Do this in the same turn as the work, before reporting back. Each entry has a date heading, then short bullets covering what was built or changed, which files were touched, and any open issues. Add new entries at the bottom and never rewrite old ones. Read this file at the start of a session to see where things stand.

@AGENTS.md

**Next.js 16:** middleware is now called `src/proxy.js`. Check the docs in `node_modules/next/dist/docs/` before relying on older Next.js patterns.

## Commands

- `npm run dev`: start the dev server.
- `npm run build`: production build.
- `npm run lint`: ESLint with `eslint-config-next`.
- There is no test runner yet.
- Do not use headless browsers or browser debugging (Playwright, Puppeteer, DevTools screenshots and similar) unless the user explicitly asks. Verify with `npm run lint` and `npm run build`.

## Current state

The frontend is set up with Next.js 16, the App Router and a `src/` directory. The `@/*` alias points to `src/*`.

- **i18n:** every route lives under `src/app/[lang]/`, and `[lang]/layout.js` is the root layout. `src/proxy.js` sends any path without a locale prefix to `/bg` or `/en`, chosen from `Accept-Language`, with `bg` as the default. UI strings live in `src/app/[lang]/dictionaries/{en,bg}.json`. Load them with `getDictionary(lang)`, which runs on the server only. Add every new string to both files.
- **Config:** `src/lib/config.js` defines `COMPETITORS` (the list the scrapers rely on), `LOCALES` and `PRICE_STATUSES`.
- **Prices:** format every price with `formatPrice(value, lang)` from `src/lib/format.js`. It always outputs EUR.
- **Animation:** `src/components/SmoothScroll.js` wraps the app in Lenis. Lenis runs on GSAP's ticker and feeds `ScrollTrigger`, so use GSAP and `ScrollTrigger` directly, with `useGSAP` from `@gsap/react`, and don't start a second animation loop.
- **Styling:** plain CSS in `src/app/globals.css`. Colors, spacing and type sizes are CSS variables on `:root`, with dark mode set by `prefers-color-scheme`. Layouts are fluid and mobile-first using `clamp()`, and touch targets are at least 44px. Use the existing variables and don't hardcode values.
- **Not built yet:** the Supabase client helpers and auth, even though `@supabase/supabase-js` and `@supabase/ssr` are already installed.

`project files/` holds the product brief (`app_info.md`), the list of competitors in scope (`markets_information.md`) and the scrapers, which were copied from `d:\work\scrapers`. The scraper docs also refer to paths that don't exist yet: `src/lib/pipeline/match.js`, `src/app/actions/products.js`, `scripts/scrape.mjs`, `scripts/match.mjs`, `supabase/migrations/0001…0009` and `.github/workflows/scrape.yml`. Build those to match the paths and contracts the scraper docs describe.

The scrapers expect these commands once the scripts exist:
- `npm run scrape` runs all scrapers. `npm run scrape kaufland lidl` runs only the ones named.
- `npm run match` runs matching in bulk.

Both read a service-role Supabase client from `.env.local`, which must set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY`.

## Product

PriceAI (npm package `priceai`) is a dashboard in English and Bulgarian. A Bulgarian grocery merchant uses it to compare their own catalog with competitor prices that are scraped every day. For each product, the app:

1. Matches it to competitor listings. A keyword search picks candidates, then Gemini confirms the match.
2. Labels the merchant's price as `competitive`, `opportunity`, `at-risk` or `unmatched`.

**Currency is EUR (`€`) only.** Bulgaria has used the euro since 1 January 2026. Never display or store лв/BGN.

**Stack:** Next.js, plain modern CSS (no Tailwind or CSS-in-JS), **JavaScript with no TypeScript**, Supabase, and Lenis with GSAP for animation. The scrapers are ES modules. Their only dependencies are `jszip` and `exceljs`.

## Scraper architecture (`project files/scrapers/`)

- **Module contract:** each scraper exports `competitorKey` and `async scrape(supabase)`, which returns `{ count, pruned }`. Every `competitorKey` must appear in `COMPETITORS` in `src/lib/config.js`, in the `competitors` table and in `markets_information.md`.
- **`index.js`** registers every scraper. `scrapeAll(supabase)` runs them one after another. When one scraper fails, the run records the failure and moves on. The results are saved to `scrape_runs` and `scrape_run_results` on a best-effort basis.
- **The client must be service-role.** Row-level security only lets the pipeline write to `competitor_listings`.
- **`shared.js` → `upsertListings`:**
  - Upserts on `(competitor_key, external_id)`, so listing `id`s stay the same across runs and `product_matches` stay valid.
  - Writes one `competitor_listing_price_history` row per listing on every run.
  - Then deletes the rows this run didn't see. If the run found fewer than half of the previous count (`PRUNE_MIN_COVERAGE`), it skips the delete, so a truncated feed can't wipe good data.
  - Writes in batches of 500.
- **Data sources:** the price-transparency law (чл. 55б ЗВЕРБ) makes large chains publish a daily price feed. `normalizeKzpRows` turns a feed's header and rows into listing rows, with one row per product code. `price` is the effective shelf price: the promo price when there is a valid one, otherwise the regular price. A promo price of `0` means the product is not on promotion. The feeds use two sets of column names, and the function reads both.
  - **The chain's own feed:** `fantastico.js` (CSV) and `lidl.js` (two XLSX files, each with its own header).
  - **Kaufland** is special. It scrapes the SSR JSON on Kaufland's own offers page, which lists promotions only, so every row gets `on_promo = true`.
  - **KZP open-data ZIP** (`kolkostruva.js`): one ZIP of about 18 MB, downloaded once per process and memoized. It holds one CSV per chain. A chain's CSV is found by its company EIK (`scrapeFromKolkostruva(supabase, key, eik)`), because the display names change. The download tries yesterday's file first and falls back up to 4 days. BILLA, METRO, BulMag, Hit Max, KAM Market, Berezka and T-Market use this source. T-Market's own feed returns 403 to GitHub runners.
- **Out of scope:** CBA (no longer in the KZP ZIP as of Sept 2026), Carrefour (left Bulgaria in 2016 and returned in 2025 through Parkmart; to reconsider) and ProMarket (publishes no чл. 55б feed).
- **Research and known issues:** `project files/data_sources_research.md` covers the legal basis (since 9 Aug 2026 the obligation comes from the ЗЗП: turnover over €25M, publish by 07:00, valid until 9 Aug 2027), the KZP data spec (only the ~101-product basket, one row per store, category codes that include pack size, promo prices that include card discounts) and the problems in the current scrapers. Read it before designing the schema or changing the scrapers.
- **Planned daily job:** GitHub Actions at 03:00 UTC runs `npm run scrape` and then `npm run match`. A script fails the job only when every item fails, not when some do.
