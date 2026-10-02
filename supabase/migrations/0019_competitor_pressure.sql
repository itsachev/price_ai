-- Per chain, for Reports: of the caller's products that chain sells (confirmed
-- match or manual link, still listed), how many it prices below the merchant,
-- and by how much on average (merchant price / chain price - 1, over those).
-- Same match set and activity window as product_overview. security invoker.
create function competitor_pressure(active_days int default 7)
returns table (
  competitor_key text,
  matched        int,
  cheaper        int,
  avg_gap        numeric
)
language sql stable security invoker set search_path = '' as $$
  select
    c.competitor_key,
    count(*)::int,
    count(*) filter (where c.price < c.mine)::int,
    round(avg(c.mine / c.price - 1) filter (where c.price < c.mine), 4)
  from (
    select p.id, p.price as mine, l.competitor_key, min(l.price) as price
    from public.products p
    join lateral (
      select v.listing_id from public.match_verdicts v where v.match_key = p.match_key and v.confirmed
      union
      select k.listing_id from public.product_links k where k.product_id = p.id
    ) m on true
    join public.competitor_listings l on l.id = m.listing_id
    where l.captured_at >= now() - make_interval(days => active_days)
      and l.price > 0
    group by p.id, p.price, l.competitor_key
  ) c
  group by c.competitor_key
$$;
