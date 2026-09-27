-- The suggested price the merchant dismissed ("Not now" on the product page).
-- That suggestion stays hidden while it would still be this price; once the
-- market, the merchant's price or their pricing rules change it, it shows again.
-- Null = nothing dismissed. The "own products" policy already covers the update.
alter table products add column dismissed_price numeric(10, 2);
