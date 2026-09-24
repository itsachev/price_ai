# In-scope Bulgarian retail chains

Canonical competitor list for PriceAI. Kept in sync with `src/lib/config.js`
(`COMPETITORS`) and the `competitors` table (`supabase/migrations/`).

## Национални и големи вериги хипермаркети / супермаркети

- Kaufland — kaufland.bg
- Lidl — lidl.bg
- BILLA — billa.bg
- Фантастико (предимно в София и региона) — fantastico.bg
- T Market — tmarket.bg
- METRO (тип Cash & Carry) — metro.bg
- Hit Max — hitmax.bg

## Дискаунтъри и по-малки вериги

- BulMag (основно в Североизточна България) — bulmag.org
- Березка (специализирана за източноевропейски стоки) — berezka.bg
- KAM Market — has a scraper (`kammarket.js`) and submits a small basket to KZP

Since 9 Aug 2026 only chains with over €25M turnover must report prices (see
`data_sources_research.md`). Smaller chains here may stop appearing in the KZP
feed.

## Removed from scope

- **Carrefour** (carrefour.bg) — left in 2016, but **returned in 2025** through
  Parkmart Holding (Carrefour Market and Carrefour Express). To reconsider once we
  have checked whether Parkmart's EIK is in the KZP open-data ZIP.
- **ProMarket** (promarket.bg) — publishes no machine-readable чл. 55б price
  export and is absent from the KZP "Колко струва" open-data feed.
