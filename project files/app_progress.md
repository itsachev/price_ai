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

## 2026-09-24: Git repo

- Initialised git, added a `README.md` and pushed the first commit to `https://github.com/itsachev/price_ai` (`main`).
- Open: an empty stray `app_progress.md` in the project root is untracked; delete it (the real log is `project files/app_progress.md`).

## 2026-09-24: AI performance rule

- `CLAUDE.md`: added a rule that AI features must never slow down the site or navigation. AI runs in scripts, the daily job or a background task and stores its results in Supabase; pages only read them. No AI calls during render, in the proxy, in layouts, on route changes or from the browser.

## 2026-09-25: Typography from the Mooni template

- Took the type system from `mooni-webflow-template.webflow.io`: Parkinsans 500 for headings with -0.02em tracking, and Inter 16px/1.5 with -0.011em tracking for body text.
- `src/app/[lang]/layout.js`: load Parkinsans (weight 500, Latin) through `next/font` as `--font-parkinsans`.
- `src/app/globals.css`: new tokens `--font-heading`, `--text-h3`, `--weight-heading` and `--tracking-heading`. Fluid h1 goes from 40 to 72px, h2 from 36 to 56px and h3 from 20 to 28px, all with Mooni's line-heights. Lead text is 18px, buttons are weight 500 and the brand mark uses the heading font.
- Open: Parkinsans has no Cyrillic, so `/bg` headings render in Inter. If that mix looks wrong, pick a heading font with Cyrillic support.

## 2026-09-25: Standing rule for modern, fluid CSS

- `CLAUDE.md`: the styling rules now require modern native CSS, with every screen covered and fluid type and layout. That means `clamp()` tokens, intrinsic grids, container queries for components, logical properties, nesting, `:has()`, `color-mix()`, `text-wrap` and no horizontal scroll.
- `src/app/globals.css`: body text (16 to 17px) and lead text (18 to 20px) now scale with the screen. New fluid tokens `--text-sm` and `--text-xs` replace all hardcoded `font-size` values. Long headings now wrap and hyphenate so Bulgarian words don't overflow on 320px screens, and paragraphs use `text-wrap: pretty`.

## 2026-09-25: Parkinsans fallback warning

- The build prints "Failed to find font override values for font `Parkinsans`" because `next/font` has no size data for it. Turbopack (inside the SWC binary) prints this even with `adjustFontFallback: false`, so no code was changed. The warning does no harm: headings fall back to Inter through `--font-heading`, which can cause a small layout shift while Parkinsans loads.

## 2026-09-25: CSS moved to `src/styles/`

- Split `src/app/globals.css` into `src/styles/`: `base/tokens.css`, `base/reset.css`, `typography/typography.css`, `layout/layout.css`, `components/{header,badge,button,card,preview}.css` and `pages/home.css`. `main.css` `@import`s them in cascade order.
- `src/app/[lang]/layout.js` now imports `@/styles/main.css`, and `globals.css` is deleted. Every rule was carried over unchanged (checked with a line-by-line diff).
- `CLAUDE.md`: the styling rule points to the new structure.

## 2026-09-25: Locale moved from the URL into a cookie

- Removed the `[lang]` route segment so URLs are now `/` and `/dashboard`. The locale comes from a `lang` cookie through `getLocale()` in `src/app/dictionaries.js`, with `Accept-Language` and then `bg` as fallbacks.
- The language switcher is now a `<form>` that posts to the `setLocale` server action in the new `src/app/actions/locale.js`. Setting the cookie re-renders the page in place, so switching language no longer reloads the page.
- Deleted `src/proxy.js`, which is no longer needed. Header links now use `next/link`; they were bare `<a>` tags that did full page loads.
- Files: `src/app/{layout,page,dictionaries}.js`, `src/app/dashboard/page.js` and `src/app/dictionaries/*` (all moved out of `[lang]/`), `src/styles/components/header.css` (switcher buttons), `src/styles/main.css` (comment) and `CLAUDE.md` (i18n section).
- Open: every route is now dynamic because it reads cookies, so nothing is statically generated. That's fine for a dashboard. Old `/bg` and `/en` URLs now return 404.

## 2026-09-25: Home page redesign

- Researched the direction with the `ui-ux-pro-max` skill (design system and font pairings), 21st.dev inspiration (bento and product-preview heroes) and a web search on 2026 SaaS landing trends. The skill's blue and amber default was rejected as generic.
- New look: "ledger" green ink on warm paper with a lime price-tag signal (`--signal`, `--band`, `--marker` and `--shadow` tokens, plus dark-mode values) in `src/styles/base/tokens.css`.
- Type: Onest 600 for headings and Geist Mono for prices and stats, loaded through `next/font` in `src/app/layout.js`. Both have Cyrillic, so this fixes the open Parkinsans/Cyrillic issue and its build warning. Inter stays for body text.
- `src/app/page.js`: a hero with a live pill, a highlighted headline word, a preview card whose bars grow in, and floating KPI chips (placed with a container query). Also a chain strip, a stats row, a bento "how it works" with a match example, status cards with colored rules, and a dark CTA band.
- CSS: `pages/home.css` and `components/preview.css` rewritten; `typography.css` (h1/h2 leading, the highlight) and `button.css` (`.button--signal`, arrow nudge) updated. New strings are in both `en.json` and `bg.json`.
- Open: the KPI numbers and the match example are illustrative, like the preview; swap them for real data once Supabase is connected.

## 2026-09-25: Fixed frozen scrolling

- Page scrolling did nothing. `ReactLenis` creates its Lenis instance inside an effect and stores it in state, so `SmoothScroll` read `lenisRef.current.lenis` as `undefined` in its one-time effect. That meant it never hooked `lenis.raf` into GSAP's ticker. With `autoRaf: false`, Lenis swallowed wheel events and never moved the page.
- `src/components/SmoothScroll.js`: gets the instance with `useLenis(ScrollTrigger.update)` (the root store) and starts the ticker in an effect that depends on it. The ref is removed.
- The reduced-motion `smoothWheel` flag is now passed as an option when Lenis is created, instead of mutating `lenis.options` (a lint error).

## 2026-09-25: Light and dark theme toggle

- Researched palettes with the `ui-ux-pro-max` skill. Its top dashboard matches are generic slate-and-blue sets, so the "ledger" palette stays. A WCAG check shows every text pairing passes AA in both themes: text 15–18:1, muted 5.7–7.6:1, accent 7.2–10.4:1, status colors 5.0–8.5:1.
- `src/styles/base/tokens.css`: color tokens are now `light-dark()` pairs, which replaces the `prefers-color-scheme` block. `:root[data-theme]` forces `color-scheme`. New `--marker-text` token replaces the dark-mode rule in `typography/typography.css`.
- New `src/app/actions/theme.js` `setTheme` server action stores a `theme` cookie, the same way `setLocale` does. `src/app/layout.js` renders it as `<html data-theme>`, so a saved choice paints on first load with no flash. Without a cookie the site follows the OS.
- The header has a sun/moon toggle, a `<form>` with two buttons. CSS in `components/header.css` shows only the one that switches away from the active theme, so no client JS is needed. New strings `nav.theme`, `nav.themeLight` and `nav.themeDark` are in both dictionaries.
- `CLAUDE.md`: the styling rule now describes the `light-dark()` and `data-theme` setup.
- Open: there's no way to go back to "follow the OS" after choosing a theme, short of clearing the cookie. Add a third "system" option if it's needed.

## 2026-09-25: Home page rebuilt after the bg-price-ai.vercel.app reference

- Studied the reference site's HTML and CSS with curl (no browser). Kept our "ledger" palette and borrowed its structure, techniques and typography.
- Type: switched to Unbounded (all text, headings 700/800) and JetBrains Mono (prices, labels, badges), both variable and with Cyrillic, in `src/app/layout.js`. The type scale in `base/tokens.css` is retuned for the wide face so Bulgarian words fit on 320px screens. Eyebrows and badges are now mono uppercase.
- AI background: a new `components/background.css` and markup in `layout.js`. It's a circuit grid with glowing nodes, three drifting glows (new `--glow-*` tokens, softer in light mode) and a slow scan line. It's pure CSS with transform-only motion, `contain: strict`, no canvas, no blur filter, and it stops under reduced motion. Cards are slightly translucent so the backdrop shows through.
- `src/app/page.js` sections:
  - a hero with a word-by-word headline reveal (CSS only, so first paint never waits for JS) and a browser-style "live scan" panel
  - the chain strip
  - count-up stats (added to `Reveal.js`)
  - six feature cards
  - a price tracker with status counts, category chips (radio buttons plus `:has()`, no JS) and a table that becomes cards below 40rem via a container query
  - a price-trend chart (server-rendered SVG with HTML ticks and dots; the line draws in with a scroll-driven CSS animation where supported)
  - AI insight cards
  - reports (top at-risk, top opportunities, matches per chain)
  - four "how it works" steps and the CTA band
- New CSS files: `components/{scan,tracker,chart,background}.css`. Removed `components/preview.css`. `pages/home.css` is rewritten; `layout.css` gained `.visually-hidden` and `.note`.
- `src/lib/format.js`: new `formatPercent(ratio, lang, sign)`. Bulgarian chart months use the first three letters of the long name, because CLDR's Bulgarian short month is numeric ("04").
- Both dictionaries have a rewritten `home` object.
- Left out on purpose: the reference site's testimonials (invented people, and fake reviews are misleading) and its loading screen (it delays first paint).
- Open: all sample numbers (scan, tracker, chart, reports) are marked "Example data". Replace them with stored Supabase results once the pipeline runs.

## 2026-09-25: Site footer

- `src/app/layout.js`: new footer on every page. It has the brand, a tagline and a pulsing "refreshed daily" pill, then three columns: product links (dashboard, how it works), the tracked chains (rendered from `COMPETITORS`, so the list stays in sync with the scrapers) and the data source. Below them sit an oversized "PriceAI" wordmark that fades out (decorative, `aria-hidden`) and a bar with the copyright and the EUR note.
- New `src/styles/components/footer.css`, imported in `main.css`. Intrinsic grid that becomes an intro-plus-three-columns layout from 64rem, links with 44px targets and an underline that grows on hover, a wordmark sized with `min(14.5vw, 12rem)` so it never overflows at 320px, and `overflow-x: clip` as a guard. It reuses the `pulse` keyframes and stops under reduced motion.
- New `footer` strings in both `en.json` and `bg.json`.
- Open: no legal pages (privacy, terms) exist yet to link from the footer.
