-- Shopper insights for /info, rebuilt once a day after the scrape by
-- refresh_shopper_insights() so the page only reads two small tables.
-- Seeded demo history (captured_at 2000-01-01, seed-history) is left out.

-- One row per still-listed listing: today's price beside its own history.
create table shopper_prices (
  listing_id     bigint primary key references competitor_listings (id),
  competitor_key text not null,
  title          text not null,
  category_code  integer,
  price          numeric(10, 2) not null,  -- typical effective price today
  regular_price  numeric(10, 2),           -- typical price before promo today
  on_promo       boolean not null,
  days           int not null,             -- feed days in the last 90
  low            numeric(10, 2) not null,  -- lowest price in the last 90 days, today included
  usual_price    numeric(10, 2) not null,  -- median price over the last 90 days
  usual_regular  numeric(10, 2),           -- median regular price over the 30 days before today
  discount       numeric,                  -- 1 - price / regular_price (promos only)
  real_discount  numeric,                  -- 1 - price / usual_regular (promos only)
  vs_usual       numeric not null,         -- price / usual_price - 1
  at_low         boolean not null          -- today is the 90-day low
);

create index on shopper_prices (real_discount desc nulls last) where on_promo;
create index on shopper_prices (vs_usual);

-- Basket index per chain: in each KZP category (kind + pack size) carried by at
-- least 3 chains, the chain's cheapest price over the median of the chains'
-- cheapest; averaged per chain. Now, and the same a week earlier.
create table chain_price_index (
  competitor_key text primary key,
  vs_average     numeric not null,  -- -0.04 = 4% cheaper than the average chain
  categories     int not null,
  week_change    numeric            -- vs_average now minus a week ago
);

alter table shopper_prices    enable row level security;
alter table chain_price_index enable row level security;
create policy "read" on shopper_prices    for select to authenticated using (true);
create policy "read" on chain_price_index for select to authenticated using (true);

create function refresh_shopper_insights(active_days int default 7)
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
    from h, newest
    where h.data_date > newest.d - active_days
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

  delete from public.chain_price_index where true;
  insert into public.chain_price_index
  with newest as (
    select max(data_date) as d from public.competitor_listing_price_history where captured_at > '2000-01-02'
  ),
  days as (
    select d as day, true as is_now from newest
    union all
    select d - 7, false from newest
  ),
  cheapest as (
    select days.is_now, l.competitor_key, l.category_code, min(h.price) as price
    from public.competitor_listing_price_history h
    join days on h.data_date = days.day
    join public.competitor_listings l on l.id = h.listing_id
    where l.category_code is not null and h.captured_at > '2000-01-02'
    group by 1, 2, 3
  ),
  ref as (
    select is_now, category_code, percentile_cont(0.5) within group (order by price) as median
    from cheapest
    group by 1, 2
    having count(*) >= 3
  ),
  idx as (
    select c.is_now, c.competitor_key, avg(c.price / r.median::numeric) as idx, count(*)::int as categories
    from cheapest c join ref r using (is_now, category_code)
    group by 1, 2
  )
  select n.competitor_key, round(n.idx - 1, 4), n.categories, round(n.idx - w.idx, 4)
  from idx n
  left join idx w on w.competitor_key = n.competitor_key and not w.is_now
  where n.is_now;

  return n;
end;
$$;

revoke execute on function refresh_shopper_insights(int) from public, anon, authenticated;
grant execute on function refresh_shopper_insights(int) to service_role;
