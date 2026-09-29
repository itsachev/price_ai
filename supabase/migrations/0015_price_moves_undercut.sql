-- price_moves() now follows the merchant's undercut rule, like priceStatus() in
-- match.js: a competitor price "beats" the merchant when that price less their
-- undercut (ignored when it's as big as the price itself) is below the
-- merchant's price. So "undercut" fires when a chain crosses the merchant's
-- target, and "raised-above" when it crosses back. The alerts and the dashboard
-- status then agree. Same signature, so callers are unchanged.
create or replace function price_moves()
returns table (
  data_date      date,
  prev_date      date,
  product_id     bigint,
  product_name   text,
  product_price  numeric,
  listing_id     bigint,
  competitor_key text,
  listing_title  text,
  kind           text,
  old_price      numeric,
  new_price      numeric,
  change_ratio   numeric,   -- (new - old) / old; null when delisted
  kind_rank      int
)
language sql stable security invoker set search_path = '' as $$
  with d as (
    select max(h.data_date) as cur from public.competitor_listing_price_history h
  ), dates as (
    select d.cur, (select max(h.data_date) from public.competitor_listing_price_history h where h.data_date < d.cur) as prev
    from d
  ), reporting as (
    -- Chains in the newest file, so a chain whose scrape failed doesn't read as "everything delisted".
    select distinct l.competitor_key
    from public.competitor_listing_price_history h
    join public.competitor_listings l on l.id = h.listing_id
    where h.data_date = (select cur from dates)
  ), matched as (
    select p.id, p.name, p.price, p.owner_id, v.listing_id
    from public.products p join public.match_verdicts v on v.match_key = p.match_key and v.confirmed
    union
    select p.id, p.name, p.price, p.owner_id, k.listing_id
    from public.products p join public.product_links k on k.product_id = p.id
  ), moves as (
    select
      dt.cur, dt.prev, m.id, m.name, m.price, l.id as listing_id, l.competitor_key, l.title,
      h0.price as old_price, h1.price as new_price, h0.on_promo as old_promo, h1.on_promo as new_promo,
      h0.price - case when u.undercut < h0.price then u.undercut else 0 end < m.price as old_beats,
      h1.price - case when u.undercut < h1.price then u.undercut else 0 end < m.price as new_beats
    from dates dt
    cross join matched m
    cross join lateral (
      select coalesce((select r.undercut from public.pricing_rules r where r.owner_id = m.owner_id), 0) as undercut
    ) u
    join public.competitor_listings l on l.id = m.listing_id
    join public.competitor_listing_price_history h0 on h0.listing_id = m.listing_id and h0.data_date = dt.prev
    left join public.competitor_listing_price_history h1 on h1.listing_id = m.listing_id and h1.data_date = dt.cur
    where h1.listing_id is not null or l.competitor_key in (select competitor_key from reporting)
  ), kinds as (
    select mv.*,
      case
        when mv.new_price is null then 'delisted'
        when mv.new_price < mv.old_price and mv.new_beats and not mv.old_beats then 'undercut'
        when mv.new_price > mv.old_price and mv.old_beats and not mv.new_beats then 'raised-above'
        when mv.new_price < mv.old_price and mv.new_promo and not mv.old_promo then 'promo-start'
        when mv.new_price < mv.old_price then 'down'
        when mv.new_price > mv.old_price and mv.old_promo and not mv.new_promo then 'promo-end'
        when mv.new_price > mv.old_price then 'up'
      end as kind
    from moves mv
  )
  select
    k.cur, k.prev, k.id, k.name, k.price, k.listing_id, k.competitor_key, k.title, k.kind, k.old_price, k.new_price,
    round((k.new_price - k.old_price) / k.old_price, 4),
    array_position(array['undercut', 'raised-above', 'promo-start', 'down', 'promo-end', 'up', 'delisted'], k.kind)
  from kinds k
  where k.kind is not null
$$;
