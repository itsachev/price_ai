> **Naming.** The product is **PriceAI**. The npm package is `priceai`.
> All monetary values are **euro (EUR, `€`)** — Bulgaria's official currency
> since 1 January 2026. The lev (`лв` / `BGN`) is never used for display or
> storage.

---

## 1. What it is

A localized (**EN / BG**) web dashboard for a Bulgarian grocery merchant to
track their own product catalog against competitor prices collected daily from
Bulgarian retail chains.

For each of the merchant's products PriceAI:

1. finds the same product at competitors (keyword shortlist + a Gemini judgment
   call),
2. classifies where the merchant stands on price — `competitive` /
   `opportunity` / `at-risk` / `unmatched`

3. dev stack: next.js, native modern css, no typescript, supabase. lenis, gsap for animations
