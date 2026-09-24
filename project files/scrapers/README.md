# Competitor price scrapers

> **Known issues (2026-09-24):** see `../data_sources_research.md`. In short:
> pruning deletes price history through the `on delete cascade` foreign key (the
> "history survives delisting" claim below is wrong); Kaufland's `offerId`
> changes every week; per-store KZP rows are collapsed to an arbitrary store;
> the feeds cover only the ~101-product basket, not the full catalog; and since
> 9 Aug 2026 the obligation comes from the ЗЗП (turnover over €25M, until
> 9 Aug 2027), not чл. 55б ЗВЕРБ.

Moved in from `d:\work\scrapers` (the grocery subset only — that directory
still holds unrelated electronics/DIY scrapers for a different consumer).
These now write **this app's** schema directly rather than a separate one.

## Module contract

Each file exports:

```js
export const competitorKey = 'kaufland';        // must match src/lib/config.js COMPETITORS
export async function scrape(supabase) { /* … */ return { count }; }
```

`index.js` holds the registry (`scrapers`) and `scrapeAll(supabase)`, which
runs each scraper in turn and collects a per-competitor
`{ ok, count, pruned | error }` result without letting one failure stop the
rest.

`scrape()` must be called with a **service-role** Supabase client — RLS
reserves writes to `competitor_listings` for the pipeline, not merchant
sessions.

## What they write

`shared.js` → `upsertListings(supabase, competitorKey, rows)` upserts into
`competitor_listings` keyed by `(competitor_key, external_id)` (see migration
`0003_competitor_listing_identity.sql`). Upsert, not insert-per-run, so a
still-listed product keeps its row `id` and its `product_matches` stay valid
from day to day. Row shape: `{ external_id, title, price }` + optional
`{ brand, size, url }`.

After the upsert it **prunes** rows the run didn't see (delisted products, or
junk from an earlier broken run) — unless the run reached under half the
previous listing count, in which case the older rows are kept (a truncated feed
download or a parser break shouldn't delete good data). Returns
`{ count, pruned }`.

`price` is the effective shelf price (promo price when on promotion), and
`on_promo` (migration `0007_add_competitor_listing_on_promo.sql`) records
whether that price currently is one — `normalizeKzpRows` sets it from the KZP
feed's promo column for every KZP-sourced competitor, while `kaufland.js`
hardcodes it `true` for every row since its only source is Kaufland's own
promotions page, not a full catalog. The product detail page
(`/products/[id]`) surfaces it as an "on promotion at X" badge when
a product's matched listing has it set.

`upsertListings` also records one `competitor_listing_price_history` row per
listing per run (migration `0008_add_price_history.sql`) — today's `price` and
`on_promo`, keyed to the listing's `id` — right after the upsert and before
pruning, so a listing that gets delisted (and its `competitor_listings` row
deleted) doesn't lose the history it already accumulated (the history table's
`listing_id` foreign key is `on delete cascade`, so it *would* be lost if the
listing were later deleted for some other reason, but pruning replaces rows by
upserting, not deleting-then-reinserting, so a still-listed product's history
stays intact across runs). This is what the product detail page's price trend
chart reads for the "market" line; there's no separate pipeline job for it.

## Data sources

Large Bulgarian retail chains must publish a **daily machine-readable price
export** under the price-transparency mandate (чл. 55б ЗВЕРБ, part of the
euro-adoption legislation): product name, code, category, retail price, promo
price. `shared.js` → `normalizeKzpRows()` maps such a feed (CSV or XLSX) into
listing rows. It reads both the standard column set and the richer variant Lidl
uses, and treats a `0` / `0.00` in the promo column as "not on promotion".

Two source shapes:

- **Own feed** — the chain hosts its export. `kaufland.js` (SSR JSON, not KZP),
  `fantastico.js`, `lidl.js`. (`tmarket.js` moved to the KZP ZIP: its own CloudCart feed 403s GitHub runners.)
- **KZP open data** — `kolkostruva.js` downloads the portal's daily ZIP
  (`https://kolkostruva.bg/opendata_files/<date>.zip`), one CSV per obligated
  retailer, and `scrapeFromKolkostruva(supabase, key, eik)` extracts one
  chain's slice by company EIK. The ~18 MB ZIP is fetched once per process and
  shared by every chain that has no reachable feed of its own: `billa.js`,
  `metro.js`, `bulmag.js`, `hitmax.js`, `kammarket.js`, `berezka.js`.

## Status

Run: `npm run scrape` (all registered) or `npm run scrape kaufland lidl`
(subset) — `scripts/scrape.mjs`, service-role client from `.env.local`.

Typical run (2026-09-07): 11/11 ok, ~13 500 listings.

| Competitor | key | Source | Status |
|-----------|-----|--------|--------|
| Kaufland | `kaufland` | own offers page (SSR JSON) | ✅ ~777 |
| Fantastico | `fantastico` | own KZP CSV | ✅ ~2250 |
| Lidl | `lidl` | own KZP XLSX ×2 (`exceljs`) — files have different layouts, each normalized against its own header | ✅ ~746 |
| T-Market | `tmarket` | KZP ZIP via kolkostruva (own CloudCart viewer 403s CI) | ✅ ~720 |
| BILLA | `billa` | kolkostruva open data | ✅ ~1490 |
| METRO | `metro` | kolkostruva open data | ✅ ~1890 |
| BulMag | `bulmag` | kolkostruva open data | ✅ ~880 |
| Hit Max | `hitmax` | kolkostruva open data | ✅ ~2920 |
| KAM Market | `kammarket` | kolkostruva open data | ✅ ~240 (chain submits a small basket) |
| Berezka | `berezka` | kolkostruva open data | ✅ ~24 (chain submits a small basket) |

Carrefour (left Bulgaria in 2016), ProMarket (no чл. 55б feed) and CBA (no longer in the KZP ZIP, 2026-09) were removed
from scope in migration `0004`.

## Open work

- [x] Cron runner: [.github/workflows/scrape.yml](../../.github/workflows/scrape.yml)
      (daily at 03:00 UTC, after feeds publish, plus `workflow_dispatch`).
      Needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
      `GEMINI_API_KEY` set as repo Actions secrets — the workflow writes them
      into a throwaway `.env.local` on the runner so `npm run scrape`/
      `npm run match` pick them up exactly as they do locally. Runs
      `npm run scrape` then `npm run match`; each script's own exit code
      already fails the step only on *total* failure (every competitor/product
      erroring), not a partial one.
- [ ] Admin "last pipeline run" view consuming the `scrapeAll` result.
- [x] Competitor matching consumes the upserted `competitor_listings` —
      `src/lib/pipeline/match.js`, run in bulk via `npm run match`
      (`scripts/match.mjs`), and now also inline per-product from the
      `addProduct` Server Action (`src/app/actions/products.js`) when a
      merchant adds a product from the dashboard.
- [x] Daily price history: `competitor_listing_price_history` (written by
      `upsertListings` on every scrape run) and `product_price_history`
      (written by the `addProduct`/`updateProduct`/`applySuggestedPrice`
      Server Actions whenever a merchant's own price is set or changes) —
      migration `0008_add_price_history.sql`. Charted on
      `/products/[id]` via `PriceTrendChart`.
