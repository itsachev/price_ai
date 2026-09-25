# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Progress log

After every piece of work that changes the project, append an entry to `app_progress.md` in the project root (git-ignored, local only). Do this in the same turn as the work, before reporting back. Each entry has a date heading, then short bullets covering what was built or changed, which files were touched, and any open issues. Add new entries at the bottom and never rewrite old ones. Read this file at the start of a session to see where things stand.

@AGENTS.md

**Next.js 16:** middleware is now called `proxy.js` (there is none yet). Check the docs in `node_modules/next/dist/docs/` before relying on older Next.js patterns.

## Commands

- `npm run dev`: start the dev server.
- `npm run build`: production build.
- `npm run lint`: ESLint with `eslint-config-next`.
- There is no test runner yet.
- Do not use headless browsers or browser debugging (Playwright, Puppeteer, DevTools screenshots and similar) unless the user explicitly asks. Verify with `npm run lint` and `npm run build`.

## Current state

The frontend is set up with Next.js 16, the App Router and a `src/` directory. The `@/*` alias points to `src/*`.

- **i18n:** URLs have no locale prefix. The locale lives in a `lang` cookie, and `getLocale()` in `src/app/dictionaries.js` reads it, falling back to `Accept-Language` and then `bg`. The header switcher is a `<form>` that posts to the `setLocale` server action (`src/app/actions/locale.js`). Setting the cookie there re-renders the page in place, with no reload or navigation. Don't reintroduce a `[lang]` segment. UI strings live in `src/app/dictionaries/{en,bg}.json`. Load them with `getDictionary(await getLocale())`, which runs on the server only. Add every new string to both files. Use `next/link` for internal links, never a bare `<a href>`.
- **Config:** `src/lib/config.js` defines `COMPETITORS` (the list the scrapers rely on), `LOCALES` and `PRICE_STATUSES`.
- **Prices:** format every price with `formatPrice(value, lang)` from `src/lib/format.js`. It always outputs EUR.
- **Animation:** `src/components/SmoothScroll.js` wraps the app in Lenis. Lenis runs on GSAP's ticker and feeds `ScrollTrigger`, so use GSAP and `ScrollTrigger` directly, with `useGSAP` from `@gsap/react`, and don't start a second animation loop.
- **Styling:** plain, modern native CSS in `src/styles/`. `main.css` is the only entry point (imported in `src/app/layout.js`) and `@import`s the rest in cascade order: `base/` (tokens, reset), `typography/`, `layout/`, `components/` (one file per component) and `pages/` (page-specific sections). Put new rules in the matching file, add new files to `main.css`, and don't import CSS from components. Colors, spacing and type sizes are CSS variables on `:root`, and every color token is a `light-dark()` pair. The theme follows the OS preference until the header toggle stores a `theme` cookie, which the root layout renders as `<html data-theme>` to force `color-scheme`. Give every new color a light and a dark value this way, and never write a separate `prefers-color-scheme` block. Use the existing variables and don't hardcode values. Touch targets are at least 44px.
  - **Every screen, fluid everything.** All content must be responsive and readable from narrow phones (320px) to wide desktops. Type sizes and spacing are fluid `clamp()` tokens, not fixed sizes that jump at breakpoints. Keep body text at 16px or larger and limit line length with a `ch`-based `max-width`.
  - **Layout:** mobile-first, with intrinsic grids (`repeat(auto-fit, minmax(min(100%, X), 1fr))`) and flex-wrap. Use container queries (`container-type`, `@container`) when a component adapts to its own width, and media queries only for page-level changes. Nothing may scroll horizontally.
  - **Modern features to prefer:** logical properties (`padding-inline`, `margin-block`), `dvh`, CSS nesting, `:has()`, `color-mix()`, `text-wrap: balance` for headings and `pretty` for paragraphs, and `min()`/`max()`.
- **AI must never slow down the site or navigation.** This covers every AI feature (Gemini matching, suggestions, summaries and anything added later). Run AI work outside the request path: in `scripts/*.mjs`, the daily job or a background task. Store the results in Supabase, and have pages only read those stored results. Never call an AI API during render, in a proxy, in a layout or on a route change, and never call one from the browser. If a user action has to trigger AI work, start it without blocking and show the result when it's ready (a server action that queues or streams, with a `Suspense` boundary). Navigation and first paint must never wait on it. Don't add AI SDKs to the client bundle.
- **Supabase:** the schema is in `supabase/migrations/` (apply with `npx supabase db push`). Use `createClient()` from `src/lib/supabase/server.js` in server code (RLS applies), `src/lib/supabase/client.js` in Client Components and `createAdminClient()` from `src/lib/supabase/admin.js` only in `scripts/`. Competitor price history has no cascade, so never delete listings. **Not built yet:** auth and `src/proxy.js` session refresh.

`project files/` is git-ignored and local only. It holds the product brief (`app_info.md`), the competitors in scope (`markets_information.md`), the data research (`data_sources_research.md`), and the old scrapers from `d:\work\scrapers`, which `src/lib/scrapers/` replaces. Still to build: `src/app/actions/products.js` and `.github/workflows/scrape.yml`.

Commands:
- `npm run scrape` runs all scrapers. `npm run scrape kaufland lidl` runs only the ones named.
- `npm run check` runs the self-checks (`scripts/check-kzp.mjs`, `scripts/check-match.mjs`).
- `npm run match` matches every product and refreshes price statuses (`src/lib/pipeline/match.js`).
- `npm run seed-demo` creates a demo merchant (`demo@priceai.test`) with a small catalog.

Both read a service-role Supabase client from `.env.local`, which must set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY`.

## Product

PriceAI (npm package `priceai`) is a dashboard in English and Bulgarian. A Bulgarian grocery merchant uses it to compare their own catalog with competitor prices that are scraped every day. For each product, the app:

1. Matches it to competitor listings. A keyword search picks candidates, then Gemini confirms the match.
2. Labels the merchant's price as `competitive`, `opportunity`, `at-risk` or `unmatched`.

**Think about the whole product.** The goal is revenue: merchants should love PriceAI, come back every day and pay for it, so it has to do more than match prices. Judge each change by that. Matching starts with grocery chains (Kaufland and the other KZP chains). Other market types (electronics, DIY, drugstores and so on) come later, so don't hard-code grocery-only assumptions into the schema, config, matching or UI. The free Gemini tier is limited in requests per minute, so matching must narrow candidates without AI first (keywords, category, pack size), batch candidates into one request, cache every verdict (rejected ones too), and throttle and resume after rate-limit errors.

**Build for later stages, and treat dev limits as config.** Before building a feature, think through how it behaves after months of history, as feeds change, as more chains, market types and merchants arrive, and when it runs unattended in CI. Development uses free tiers (Gemini, Supabase). Production will use paid plans with higher limits and possibly stronger models. Switching must be a config change, not a rewrite. Read model names, rate limits, batch sizes, concurrency and quotas from env or config, with free-tier defaults. Never cap a feature's reach or quality to fit the dev tier. Keep caching, batching and throttling in production too, but make their numbers adjustable. Derive thresholds from stored data rather than hand-set constants.

**Currency is EUR (`€`) only.** Bulgaria has used the euro since 1 January 2026. Never display or store лв/BGN.

**Stack:** Next.js, plain modern CSS (no Tailwind or CSS-in-JS), **JavaScript with no TypeScript**, Supabase, and Lenis with GSAP for animation. The package is `"type": "module"`. The scrapers' only dependency is `jszip`.

## Scraper architecture (`src/lib/scrapers/`)

- **One source: the KZP open-data ZIP** (`kzp.js`). `https://kolkostruva.bg/opendata_files/<date>.zip` holds one CSV per chain, found by company EIK because display names change. It is fetched once per process and memoized, trying yesterday first and falling back up to 4 days. The ZIP's date is stored as `data_date`, not the run date. Every chain in scope is in it, with stable product codes, regular and promo prices, the KZP category and one row per store. The chains' own feeds and Kaufland's offers page are no longer used (Kaufland's weekly offer IDs broke matches and history).
- **`parseCsv`** is lenient: it detects `,` or `;`, and a quote closes a field only before a delimiter or line end (Lidl's CSV has stray quotes). Prices accept a decimal comma.
- **`aggregateRows`** collapses per-store rows into one row per code: the typical (most common) effective price, the typical regular price, min/max and store count. A promo counts only when it is positive and below retail.
- **`index.js`:** `KZP_CHAINS` maps each `competitorKey` to its EIKs (Fantastico has two) and a `minCodes` floor (about a third of a normal day). The floor applies only while the chain has no history from the last 7 days. After that, the check compares against the chain's own recent data, so hand-set numbers can't go stale. `scrapers` is a list of `{ competitorKey, scrape(supabase) }`, and a non-ZIP scraper can be added to it later. Every key must appear in `COMPETITORS`, the `competitors` table and `markets_information.md`. `scrapeAll(supabase, keys)` runs them one after another, records failures and moves on, and logs to `scrape_runs` and `scrape_run_results` on a best-effort basis.
- **`upsertListings`** upserts listings on `(competitor_key, external_id)` and history on `(listing_id, data_date)` in batches of 500, so a rerun is harmless. It never deletes: a delisted product stops getting history, and `captured_at` shows when it was last seen. A feed with under half the codes seen in the last 7 days is rejected as truncated or wrong.
- **The client must be service-role.** Row-level security only lets the pipeline write competitor data.
- **Out of scope:** CBA (no longer in the KZP ZIP as of Sept 2026), Carrefour (left Bulgaria in 2016 and returned in 2025 through Parkmart; to reconsider) and ProMarket (publishes no чл. 55б feed).
- **Research and known issues:** `project files/data_sources_research.md` covers the legal basis (since 9 Aug 2026 the obligation comes from the ЗЗП: turnover over €25M, publish by 07:00, valid until 9 Aug 2027), the KZP data spec (only the ~101-product basket, one row per store, category codes that include pack size, promo prices that include card discounts) and the problems found in the old scrapers. Read it before changing the schema or the scrapers.
- **Planned daily job:** GitHub Actions at 03:00 UTC runs `npm run scrape` and then `npm run match`. A script fails the job only when every item fails, not when some do.

## Matching (`src/lib/pipeline/match.js`)

- **Narrowing without AI:** titles are transliterated to Latin (feeds mix "Vereya" and "Верея") and tokenized. Listings are scored by shared tokens weighted by IDF over all active listings, so brands count most. A listing is dropped if its KZP category differs (when the product has one) or its pack size differs. The top `MATCH_CANDIDATES_PER_CHAIN` per chain are kept.
- **Verdict cache:** `match_verdicts` is keyed on `(match_key, listing_id)`. `match_key` is the product's normalized name, brand and size, so merchants selling the same product share verdicts, and rejected pairs are never asked again. `product_matches` is a `security_invoker` view over it. Renaming a product clears `match_key` (trigger), so it's matched again.
- **Gemini:** plain `fetch` to the REST API (no SDK), many pairs per request with a JSON response schema, throttled to `GEMINI_RPM`. Per-minute 429s wait out the server's retry delay. A daily quota or a lasting 5xx stops the run without failing it, and the next run resumes from the cache.
- **Status:** the merchant's price is compared with the cheapest confirmed, still-listed competitor price, using `MATCH_PRICE_TOLERANCE`.
- **Env (free-tier defaults):** `GEMINI_MODEL` (`gemini-3.5-flash`), `GEMINI_RPM` (10), `MATCH_PAIRS_PER_REQUEST` (60), `MATCH_MAX_REQUESTS` (unlimited), `MATCH_CANDIDATES_PER_CHAIN` (3), `MATCH_MIN_SCORE` (0.35), `MATCH_MIN_CONFIDENCE` (0.7), `MATCH_PRICE_TOLERANCE` (0.03), `MATCH_ACTIVE_DAYS` (7).
