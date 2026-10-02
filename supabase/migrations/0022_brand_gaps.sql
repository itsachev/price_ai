-- Price position per brand: how many of the caller's products carry the brand,
-- how many are compared, the at-risk / opportunity split and the average gap to
-- the cheapest chain (positive = pricier). Brands with fewer than two compared
-- products are left out, one product is not a pattern. Brand is matched
-- case-insensitively. security invoker: RLS limits it to the caller's products.
create function brand_gaps(active_days int default 7)
returns table (
  brand       text,
  products    int,
  matched     int,
  at_risk     int,
  opportunity int,
  avg_gap     numeric
)
language sql stable security invoker set search_path = '' as $$
  select min(o.brand), count(*)::int, count(o.best_price)::int,
         (count(*) filter (where o.price_status = 'at-risk'))::int,
         (count(*) filter (where o.price_status = 'opportunity'))::int,
         round(avg(o.gap_ratio), 4)
  from public.product_overview(active_days) o
  where nullif(trim(o.brand), '') is not null
  group by lower(trim(o.brand))
  having count(o.best_price) >= 2
$$;
