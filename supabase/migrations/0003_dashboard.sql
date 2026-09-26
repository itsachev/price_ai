-- Dashboard: each product with its cheapest confirmed, still-listed competitor
-- price. A function rather than a view so the "still listed" window follows
-- MATCH_ACTIVE_DAYS; PostgREST can still filter, order and page its result.
-- security invoker: RLS on products and match_verdicts applies, so a merchant
-- only ever sees their own catalog.
create function product_overview(active_days int default 7)
returns table (
  id              bigint,
  name            text,
  brand           text,
  size            text,
  price           numeric,
  price_status    text,
  status_rank     int,      -- at-risk first, unmatched last
  best_price      numeric,
  best_competitor text,
  best_on_promo   boolean,
  chain_count     int,
  gap             numeric,  -- merchant price minus cheapest; positive = pricier
  gap_ratio       numeric,
  urgency         numeric   -- abs(gap_ratio), sorts the biggest gaps first
)
language sql stable security invoker set search_path = '' as $$
  select
    p.id, p.name, p.brand, p.size, p.price, p.price_status,
    array_position(array['at-risk', 'opportunity', 'competitive', 'unmatched'], p.price_status),
    b.price, b.competitor_key, b.on_promo, b.chains::int,
    p.price - b.price,
    round((p.price - b.price) / b.price, 4),
    abs(round((p.price - b.price) / b.price, 4))
  from public.products p
  left join lateral (
    select min(l.price) as price,
           (array_agg(l.competitor_key order by l.price, l.competitor_key))[1] as competitor_key,
           (array_agg(l.on_promo order by l.price, l.competitor_key))[1] as on_promo,
           count(distinct l.competitor_key) as chains
    from public.match_verdicts v
    join public.competitor_listings l on l.id = v.listing_id
    where v.match_key = p.match_key
      and v.confirmed
      and l.captured_at >= now() - make_interval(days => active_days)
  ) b on true
$$;

-- "Data as of" reads the newest KZP file date; without this it scans all history.
create index on competitor_listing_price_history (data_date);
