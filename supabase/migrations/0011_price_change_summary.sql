-- What the merchant's own price changes did over the last period_days, per
-- source (apply, manual, csv), for Reports. Each change is compared with the
-- price before it, so a product's first price (no previous one) is not counted.
-- competitive_now: products changed from that source that are competitive
-- today, e.g. how many applied suggestions put the product level with the market.
-- security invoker: RLS limits the history to the caller's products.
create function price_change_summary(period_days int default 30)
returns table (
  source          text,
  changes         int,
  rises           int,
  cuts            int,
  avg_rise        numeric, -- mean new / old - 1 over rises
  avg_cut         numeric, -- mean new / old - 1 over cuts (negative)
  products        int,
  competitive_now int
)
language sql stable security invoker set search_path = '' as $$
  -- ponytail: the window reads each product's whole history; start it at the
  -- last change before the period if history gets long.
  with h as (
    select h.product_id, h.source, h.price, h.recorded_at,
           lag(h.price) over (partition by h.product_id order by h.recorded_at, h.id) as prev
    from public.product_price_history h
  )
  select
    h.source,
    count(*)::int,
    count(*) filter (where h.price > h.prev)::int,
    count(*) filter (where h.price < h.prev)::int,
    round(avg(h.price / h.prev - 1) filter (where h.price > h.prev), 4),
    round(avg(h.price / h.prev - 1) filter (where h.price < h.prev), 4),
    count(distinct h.product_id)::int,
    count(distinct h.product_id) filter (where p.price_status = 'competitive')::int
  from h
  join public.products p on p.id = h.product_id
  where h.prev is not null
    and h.price <> h.prev
    and h.recorded_at >= now() - make_interval(days => period_days)
  group by h.source
$$;
