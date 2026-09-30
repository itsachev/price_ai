-- Same as 0007, plus held: an at-risk product whose margin rule (0013) leaves no
-- room to cut, because cost / (1 - min_margin) is at or above today's price.
-- Mirrors the margin floor in suggestPrice (match.js). The dashboard sorts held
-- rows after the at-risk ones the merchant can still act on.
drop function product_overview(int);

create function product_overview(active_days int default 7)
returns table (
  id               bigint,
  name             text,
  brand            text,
  size             text,
  price            numeric,
  price_status     text,
  status_rank      int,      -- at-risk first, unmatched last
  best_price       numeric,
  best_competitor  text,
  best_on_promo    boolean,
  chain_count      int,
  gap              numeric,  -- merchant price minus cheapest; positive = pricier
  gap_ratio        numeric,
  urgency          numeric,  -- abs(gap_ratio), sorts the biggest gaps first
  suggestion_count int,      -- possible, still-listed, not yet linked
  sku              text,     -- searched by the dashboard
  match_key        text,     -- null while the product is still being matched
  held             boolean   -- at risk, but the margin rule allows no cut
)
language sql stable security invoker set search_path = '' as $$
  select
    p.id, p.name, p.brand, p.size, p.price, p.price_status,
    array_position(array['at-risk', 'opportunity', 'competitive', 'unmatched'], p.price_status),
    b.price, b.competitor_key, b.on_promo, b.chains::int,
    p.price - b.price,
    round((p.price - b.price) / b.price, 4),
    abs(round((p.price - b.price) / b.price, 4)),
    s.n::int,
    p.sku, p.match_key,
    coalesce(
      p.price_status = 'at-risk'
        and ceil(p.cost / (1 - r.min_margin) * 100 - 1e-9) / 100 >= p.price,
      false
    )
  from public.products p
  left join public.pricing_rules r on r.owner_id = p.owner_id
  left join lateral (
    select min(l.price) as price,
           (array_agg(l.competitor_key order by l.price, l.competitor_key))[1] as competitor_key,
           (array_agg(l.on_promo order by l.price, l.competitor_key))[1] as on_promo,
           count(distinct l.competitor_key) as chains
    from (
      select v.listing_id from public.match_verdicts v where v.match_key = p.match_key and v.confirmed
      union
      select k.listing_id from public.product_links k where k.product_id = p.id
    ) m
    join public.competitor_listings l on l.id = m.listing_id
    where l.captured_at >= now() - make_interval(days => active_days)
  ) b on true
  left join lateral (
    select count(*) as n
    from public.match_verdicts v
    join public.competitor_listings l on l.id = v.listing_id
    where v.match_key = p.match_key
      and v.possible
      and l.captured_at >= now() - make_interval(days => active_days)
      and not exists (select 1 from public.product_links k where k.product_id = p.id and k.listing_id = v.listing_id)
  ) s on true
$$;
