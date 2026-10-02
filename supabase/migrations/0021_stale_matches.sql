-- Products that have a confirmed match or manual link but no listing seen in
-- the last active_days (the window product_overview uses), so they have fallen
-- out of comparison. last_seen / chain are the most recently seen matched
-- listing. security invoker: RLS limits it to the caller's products.
create function stale_matches(active_days int default 7)
returns table (
  id             bigint,
  name           text,
  competitor_key text,
  last_seen      timestamptz
)
language sql stable security invoker set search_path = '' as $$
  select distinct on (p.id) p.id, p.name, l.competitor_key, l.captured_at
  from public.products p
  join lateral (
    select v.listing_id from public.match_verdicts v where v.match_key = p.match_key and v.confirmed
    union
    select k.listing_id from public.product_links k where k.product_id = p.id
  ) m on true
  join public.competitor_listings l on l.id = m.listing_id
  where not exists (
    select 1
    from (
      select v.listing_id from public.match_verdicts v where v.match_key = p.match_key and v.confirmed
      union
      select k.listing_id from public.product_links k where k.product_id = p.id
    ) m2
    join public.competitor_listings l2 on l2.id = m2.listing_id
    where l2.captured_at >= now() - make_interval(days => active_days)
  )
  order by p.id, l.captured_at desc
$$;
