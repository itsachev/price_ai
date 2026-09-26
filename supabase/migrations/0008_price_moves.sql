-- Reports: what changed at the chains between the two newest KZP file dates,
-- for the listings matched to the caller's products (confirmed verdicts and
-- manual links). One row per product and listing that moved, most urgent first.
-- security invoker: RLS on products, match_verdicts and product_links applies.
--
-- kind:
--   undercut     competitor dropped below the merchant's current price
--   raised-above competitor rose from below to at or above the merchant's price
--   promo-start  price dropped because a promo started
--   down / up    any other price move
--   promo-end    price rose because a promo ended
--   delisted     listed on the previous date, gone now (its chain did report)
-- ponytail: compares only the two newest dates; add a "since" date once
-- merchants want a weekly view.
create function price_moves()
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
    select p.id, p.name, p.price, v.listing_id
    from public.products p join public.match_verdicts v on v.match_key = p.match_key and v.confirmed
    union
    select p.id, p.name, p.price, k.listing_id
    from public.products p join public.product_links k on k.product_id = p.id
  ), moves as (
    select
      dt.cur, dt.prev, m.id, m.name, m.price, l.id as listing_id, l.competitor_key, l.title,
      h0.price as old_price, h1.price as new_price,
      case
        when h1.listing_id is null then 'delisted'
        when h1.price < h0.price and h1.price < m.price and h0.price >= m.price then 'undercut'
        when h1.price > h0.price and h1.price >= m.price and h0.price < m.price then 'raised-above'
        when h1.price < h0.price and h1.on_promo and not h0.on_promo then 'promo-start'
        when h1.price < h0.price then 'down'
        when h1.price > h0.price and h0.on_promo and not h1.on_promo then 'promo-end'
        when h1.price > h0.price then 'up'
      end as kind
    from dates dt
    cross join matched m
    join public.competitor_listings l on l.id = m.listing_id
    join public.competitor_listing_price_history h0 on h0.listing_id = m.listing_id and h0.data_date = dt.prev
    left join public.competitor_listing_price_history h1 on h1.listing_id = m.listing_id and h1.data_date = dt.cur
    where h1.listing_id is not null or l.competitor_key in (select competitor_key from reporting)
  )
  select
    mv.cur, mv.prev, mv.id, mv.name, mv.price, mv.listing_id, mv.competitor_key, mv.title, mv.kind, mv.old_price, mv.new_price,
    round((mv.new_price - mv.old_price) / mv.old_price, 4),
    array_position(array['undercut', 'raised-above', 'promo-start', 'down', 'promo-end', 'up', 'delisted'], mv.kind)
  from moves mv
  where mv.kind is not null
$$;
