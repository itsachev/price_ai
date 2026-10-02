-- Per chain, for Reports: how the shelf prices of the caller's matched products
-- moved over period_days, and how many are on promo now against then.
-- Shelf price = regular price (promos excluded) so a promo isn't read as a cut.
-- "Then" is each listing's newest row on or before newest feed date - period_days;
-- listings with no row that old are left out. security invoker.
create function chain_movement(period_days int default 30)
returns table (
  competitor_key text,
  tracked        int,      -- listings with a price now and then
  raised         int,
  cut            int,
  avg_change     numeric,  -- mean now / then - 1 over tracked
  promo_now      int,
  promo_then     int
)
language sql stable security invoker set search_path = '' as $$
  with newest as (select max(data_date) as d from public.competitor_listing_price_history),
  m as (
    select v.listing_id
    from public.products p
    join public.match_verdicts v on v.match_key = p.match_key and v.confirmed
    union
    select k.listing_id
    from public.product_links k
    join public.products p on p.id = k.product_id
  ),
  cur as (
    select h.listing_id, coalesce(h.regular_price, h.price) as price, h.on_promo
    from public.competitor_listing_price_history h, newest
    where h.data_date = newest.d and h.listing_id in (select listing_id from m)
  ),
  old as (
    select distinct on (h.listing_id) h.listing_id, coalesce(h.regular_price, h.price) as price, h.on_promo
    from public.competitor_listing_price_history h, newest
    where h.data_date <= newest.d - period_days and h.listing_id in (select listing_id from m)
    order by h.listing_id, h.data_date desc
  )
  select
    l.competitor_key,
    count(*)::int,
    count(*) filter (where cur.price > old.price)::int,
    count(*) filter (where cur.price < old.price)::int,
    round(avg(cur.price / old.price - 1), 4),
    count(*) filter (where cur.on_promo)::int,
    count(*) filter (where old.on_promo)::int
  from cur
  join old using (listing_id)
  join public.competitor_listings l on l.id = cur.listing_id
  group by l.competitor_key
$$;
