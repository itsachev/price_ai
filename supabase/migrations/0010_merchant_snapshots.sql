-- One row per merchant per market day, written by the daily job after matching,
-- so Reports read months of trends from a few rows instead of recomputing them.
-- Keyed on the feed's data_date (the day the competitor prices are from): a
-- rerun or a stale feed updates that day's row instead of adding a copy.
create table merchant_snapshots (
  owner_id        uuid not null references auth.users (id) on delete cascade,
  data_date       date not null,
  products        int not null,
  at_risk         int not null,
  opportunity     int not null,
  competitive     int not null,
  unmatched       int not null,
  -- 100 = priced like the market; geometric mean over matched products of
  -- price / average still-listed matched competitor price.
  price_index     numeric(7, 2),
  index_products  int not null,  -- products in the index (matched)
  avg_margin      numeric(6, 4), -- mean (price - cost) / price, products with a cost
  margin_products int not null,
  created_at      timestamptz not null default now(),
  primary key (owner_id, data_date)
);

alter table merchant_snapshots enable row level security;

create policy "own snapshots" on merchant_snapshots for select to authenticated
  using (owner_id = (select auth.uid()));

-- Called by `npm run match` (service role) after statuses are refreshed.
-- Returns the number of merchants written. Market prices are the same
-- confirmed and linked, still-listed matches product_overview uses.
create function record_snapshots(active_days int default 7)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  day date := (select max(data_date) from public.competitor_listing_price_history);
  written int;
begin
  if day is null then
    return 0;
  end if;

  insert into public.merchant_snapshots as s (
    owner_id, data_date, products, at_risk, opportunity, competitive, unmatched,
    price_index, index_products, avg_margin, margin_products
  )
  select
    p.owner_id, day, count(*),
    count(*) filter (where p.price_status = 'at-risk'),
    count(*) filter (where p.price_status = 'opportunity'),
    count(*) filter (where p.price_status = 'competitive'),
    count(*) filter (where p.price_status = 'unmatched'),
    round(100 * exp(avg(ln(p.price / m.avg_price))), 2),
    count(m.avg_price),
    round(avg((p.price - p.cost) / p.price) filter (where p.cost is not null), 4),
    count(p.cost)
  from public.products p
  left join lateral (
    select avg(l.price) as avg_price
    from (
      select v.listing_id from public.match_verdicts v where v.match_key = p.match_key and v.confirmed
      union
      select k.listing_id from public.product_links k where k.product_id = p.id
    ) x
    join public.competitor_listings l on l.id = x.listing_id
    where l.captured_at >= now() - make_interval(days => active_days) and l.price > 0
  ) m on true
  group by p.owner_id
  on conflict (owner_id, data_date) do update set
    products = excluded.products, at_risk = excluded.at_risk, opportunity = excluded.opportunity,
    competitive = excluded.competitive, unmatched = excluded.unmatched,
    price_index = excluded.price_index, index_products = excluded.index_products,
    avg_margin = excluded.avg_margin, margin_products = excluded.margin_products,
    created_at = now();
  get diagnostics written = row_count;
  return written;
end;
$$;

-- Pipeline only: merchants read their rows through the policy above.
revoke execute on function record_snapshots(int) from public, anon, authenticated;
