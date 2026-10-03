-- /info dropped its cheapest-chain section, so the chain index goes. Insights
-- now also require the listing to be seen by a recent scrape (captured_at), as
-- the finder does, so retired listings drop out at once.

drop table chain_price_index;

create or replace function refresh_shopper_insights(active_days int default 7)
returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from public.shopper_prices where true;
  insert into public.shopper_prices
  with h as (
    select * from public.competitor_listing_price_history
    where captured_at > '2000-01-02'
  ),
  newest as (select max(data_date) as d from h),
  cur as (
    select distinct on (h.listing_id) h.*
    from h
    join public.competitor_listings l on l.id = h.listing_id
    cross join newest
    where h.data_date > newest.d - active_days
      and l.captured_at > now() - make_interval(days => active_days)
    order by h.listing_id, h.data_date desc
  ),
  stats as (
    select h.listing_id,
      count(*)::int as days,
      min(h.price) as low,
      percentile_cont(0.5) within group (order by h.price) as usual_price,
      percentile_cont(0.5) within group (order by coalesce(h.regular_price, h.price))
        filter (where h.data_date >= cur.data_date - 30 and h.data_date < cur.data_date) as usual_regular
    from h join cur using (listing_id)
    where h.data_date > cur.data_date - 90
    group by h.listing_id
  )
  select l.id, l.competitor_key, l.title, l.category_code,
    cur.price, cur.regular_price, cur.on_promo,
    s.days, s.low, round(s.usual_price::numeric, 2), round(s.usual_regular::numeric, 2),
    case when cur.on_promo and cur.regular_price > cur.price then round(1 - cur.price / cur.regular_price, 4) end,
    case when cur.on_promo and s.usual_regular > 0 then round(1 - cur.price / s.usual_regular::numeric, 4) end,
    round(cur.price / s.usual_price::numeric - 1, 4),
    cur.price <= s.low
  from cur
  join stats s using (listing_id)
  join public.competitor_listings l on l.id = cur.listing_id;
  get diagnostics n = row_count;

  return n;
end;
$$;
