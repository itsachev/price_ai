# Data sources research (2026-09-24)

Findings from web research, the KZP data specification, and a review of the
scrapers in `project files/scrapers/`. Read this before changing the scrapers or
designing the database schema.

## Legal basis

- **чл. 55б ЗВЕРБ** (euro-adoption law) required retailers with over 10M BGN
  turnover to publish daily prices. The KZP spec ties it to the dual-price
  display period, which ended on 8 Aug 2026.
- **Since 9 Aug 2026** the obligation continues under new ЗЗП amendments (the
  ban on unjustified price increases). It covers retailers of food and drinks with
  **over €25M** turnover. They must publish a CSV on their own website **by 07:00**
  and submit it to KZP **by 08:00**. It lasts **until 9 Aug 2027**.
- Consequences:
  - The higher threshold may let smaller chains (Berezka, KAM Market, possibly
    BulMag and Hit Max) stop reporting. Check the September ZIPs.
  - The free per-store data source may disappear after August 2027 unless the
    law is extended. Track this.

## KZP "Колко струва" data (from the official submission spec)

- **Scope:** only the "large consumer basket" (~101 product groups). It is not
  a full catalog, and seasonal items are missing.
- **Open data:** `https://kolkostruva.bg/opendata_files/<YYYY-MM-DD>.zip`, one CSV
  per chain, with the company EIK in the file name.
- **One row per product per store per day.** A product a store doesn't carry has
  no row, so the data also shows availability.
- **Columns, in fixed order:** `Населено място` (5-digit EKATTE code), `Търговски
  обект` (store name, used as the store's key), `Наименование на продукта`, `Код
  на продукта` (stable chain code, max 32 characters), `Категория` (KZP numeric
  code), `Цена на дребно`, `Цена в промоция` (optional).
- **Category codes include pack size**, for example `12: "Кисели млека от 400гр"`
  and `15: "Кисели млека от 500гр"`. A public GET endpoint returns all codes as
  JSON with no login. Its URL is not in the spec yet. This is close to a ready-made
  matching key across chains.
- **Promo price** is what the customer actually pays that day. It **includes
  loyalty-card discounts** ("отстъпка с карта"), and multi-buy offers become a
  unit price ("2 for 5" becomes 2.50). It is ignored if it is empty, 0, or not
  below the retail price. The data does not say which kind of discount it is.
- **Product names** are fixed at the first submission. The code is the key.
- **Timing:** one file per chain per day, which cannot be corrected after it is
  accepted. Rejected files can be resubmitted until 12:00. A missed deadline
  means that day is empty. The ZIP is published with a lag of 1 day or more, so
  store the date of the data, not the date of the run.
- **Chains' own website files** (ал. 5) are richer: brand, net quantity,
  reference price, **promo duration** and % change (for example Lidl's
  `ExportSecondList.xlsx`). Use them for promo end dates, and the ZIP for store
  coverage.
- **Known problems** reported by other projects: truncated downloads, broken
  UTF-8 at the end of a CSV, and chains missing some days.

## Promotions

| Source | What it gives |
|---|---|
| KZP `Цена в промоция` | Daily promo price for basket items, including card discounts. No end dates |
| Chains' own ал. 5 files | Promo duration and reference price |
| Kaufland offers page (SSR JSON) | Weekly offers only, no regular price. Offer IDs change every week |
| BILLA `billa.bg/promocii/sedmichna-broshura` | Plain HTML with old and new price. Many offers are BILLA Card cashback |
| Lidl `lidl.bg/c/broshura/s10020060` | Brochures on `leaflets.schwarz`. Not yet checked whether product JSON is available |
| broshura.bg, broshurko.bg, marketinfo.app | Second-hand, often PDF images. Use only to check that promos aren't missed. marketinfo.app is effectively a competitor |

## Full catalogs (beyond the basket)

BILLA (4,000+ products), Kaufland (about 10 cities) and Fantastico sell on
Glovo, and Fantastico also on Wolt. BILLA and Kaufland say the prices match the
store they deliver from. This is the only full-catalog source, but Glovo's terms
of service forbid scraping and its API is private. Using it is a business
decision.

## Market changes

- **Carrefour is back in Bulgaria** (2025, franchised through Parkmart Holding,
  as Carrefour Market and Carrefour Express). The earlier "left in 2016" note is
  out of date. Check whether Parkmart's EIK is in the KZP ZIP before adding it to
  scope.
- ProMarket is still out of scope.

## Problems in the current scrapers

1. **Pruning deletes price history.** `upsertListings` deletes unseen listings,
   and `competitor_listing_price_history.listing_id` uses `on delete cascade`, so
   a delisted product loses its history. The scraper README says the opposite.
2. **Kaufland listings change every week.** `external_id` is the weekly
   `offerId`, so listings, matches and history reset every week. Kaufland's own
   CSV in the KZP ZIP has stable codes and regular prices. Use it as the base,
   and the offers page only for promo details.
3. **Store-level data is collapsed at random.** `normalizeKzpRows` keeps the
   first row for each product code, which is an arbitrary store. That is wrong
   for chains that price by store (BILLA, Fantastico, T-Market).
4. **Kaufland may save future offers.** All offer `cycles` are read without
   checking dates. Not verified yet.
5. **Dates:** `captured_at` is the run time, not the date of the data. The cron
   runs at 03:00 UTC, which is 06:00 in Sofia and before the 07:00 publishing
   deadline, so the chains' own feeds may be stale.
6. **Out-of-date comments:** "full catalog" and the чл. 55б references.
   `billa.js` says BILLA has no website feed, but the law requires one.

## Real ZIP check (`2026-09-23.zip`, run on 2026-09-24)

20.7 MB zipped and 175 MB unzipped: 75 CSVs and about 1.03M rows. Many of the
files are pharmacies, drugstores, DIY shops and duty-free, not grocery chains.

- **Which chains are in it.** BILLA, Kaufland, Lidl, Fantastico (under two EIKs:
  `206255903` and a franchise, `831556063`), T-Market, METRO, BulMag, Hit Max,
  KAM and Berezka are all present. **CBA (`202420609`) is missing**, so
  `cba.js` will fail. **Carrefour/Parkmart is missing.** Others that could be
  added: МИНИМАРТ (356 stores), Пацони, Валди, Коме СВА, СИБИЕС, Магазини ДАР,
  Жанет, eBag.
- **Coverage is more than the basket.** Codes per chain: Hit Max 2,921,
  Kaufland 2,499, Fantastico 2,242, METRO 1,866, BILLA 1,486, Lidl 775,
  T-Market 733, Berezka 24.
- **Header.** 72 files use the documented comma header. **3 files use `;` as
  the delimiter** (Бакалия, Гризли, Маркет Диана), and `parseCsv` reads each of
  their lines as a single column.
- **Decimals.** Almost every file uses `.`. 3 small pharmacy and fish files use
  `,`, and `parseFloat("7,06")` returns 7.
- **Broken quoting in Lidl.** Rows like `"Krina;" Бял боб (ОНТ 400)"` have a
  stray quote inside a field. `parseCsv` then swallows the rest of the file into
  one field: 103,223 lines become 53,164 rows. Parse leniently: a quote closes a
  field only when a delimiter or the end of the line follows it.
- **Prices vary between stores for only some chains.** Share of codes whose
  price varies, with the largest spread: BILLA 342/1,486 (up to 16%),
  МИНИМАРТ 410/610 (59%), Hit Max 2,915/2,921 (3 stores, up to 217%). Lidl,
  T-Market, BulMag, Lilly and DM are the same in every store. Kaufland varies in
  1 code. A single national price is fine for most chains. For the others,
  store a min and max or a per-store price instead of the first row.
- **Dirty values.** 2,444 rows have a retail price of 0 or none (for example
  Kaufland rows with retail `0` and promo set). 30 rows have a promo above
  retail, and 627 have a promo equal to retail. There are 4,735 duplicate
  store+code rows. Category is `-1`, `.` or padded with spaces in a few rows.
- **Matching.** Titles are the chain's own abbreviations (`031 БОНИ ШПЕК
  САНДВИЧ/ 330ГР`, `Kristal Чаени Бисквити SK1`). Only 4 titles are identical
  across BILLA, Kaufland, Lidl and Fantastico. Category code plus a fuzzy title
  is the realistic matching key.
- **Kaufland and Lidl** can come from the ZIP, with stable codes and regular
  prices. That fixes the weekly ID change and the promo-only data.

## Next steps

1. ~~Download one real ZIP and check it.~~ Done, see above. Still open: the
   category endpoint and the dates on Kaufland's offer cycles.
2. Design the schema from the results:
   - stores (EKATTE)
   - listings keyed by chain and product code
   - daily prices with the date of the data, store or region, and promo flag
   - category code
   - promo end dates
   - no cascade that deletes history
3. Build the migrations, then adapt the scrapers to them.

## Sources

- KZP instructions: https://kzp.bg/bg/kolkostruva/instructions (spec PDF linked there)
- KZP FAQ: https://kzp.bg/bg/kolkostruva/faq
- Open data: https://www.kolkostruva.bg/opendata
- ЗЗП rules from 9 Aug 2026: https://www.pravatami.bg/s/neobosnovano-vdigane-ceni-evro-kzk-kzp-2026
- https://www.economic.bg/bg/a/view/posledni-dni-s-oboznachavane-na-cenite-v-leva-kakvo-predstoi
- https://www.dataplus-bg.com/kray-na-dvojnoto-oboznachavane/
- SaveCheck (KZP CSV problems): https://github.com/Tems-git/SaveCheck
- BILLA on Glovo: https://www.billa.bg/billa-e-online-v-glovo
- Kaufland on Glovo: https://boulevardbulgaria.bg/articles/kaufland-veche-predlaga-onlayn-pazaruvane-s-dostavka-chrez-glovo
- Fantastico on Wolt and Glovo: https://www.capital.bg/biznes/stoki_i_prodajbi/2026/02/05/4879644_fantastiko_veche_shte_dostavia_produkti_i_prez_wolt_i/
- Carrefour returns: https://www.esmmagazine.com/retail/carrefour-returns-to-bulgaria-after-a-decade-262879
