-- In-site notifications: what changed since the merchant last looked. The daily
-- job writes them after matching (record_notifications); pages only read them.
-- Rows hold data, not text, so the header renders them in the viewer's language.
--
-- kind:
--   undercut, raised-above, promo-start, promo-end, delisted   (from price_moves())
--   matched   products whose first match finished in the daily job (count)
-- The unique key makes reruns on the same feed date add nothing.
create table notifications (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  data_date   date not null,
  kind        text not null,
  product_id  bigint references products (id) on delete cascade,
  listing_id  bigint references competitor_listings (id),
  old_price   numeric(10, 2),
  new_price   numeric(10, 2),
  count       int,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique nulls not distinct (owner_id, data_date, kind, product_id, listing_id)
);

create index on notifications (owner_id, data_date desc, id);
create index on notifications (owner_id) where read_at is null;

alter table notifications enable row level security;

create policy "own notifications" on notifications for select to authenticated
  using (owner_id = (select auth.uid()));

-- Merchants may only mark their own rows read.
create policy "mark own read" on notifications for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke insert, update, delete on notifications from anon, authenticated;
grant update (read_at) on notifications to authenticated;

-- Called by `npm run match` (service role, so price_moves() sees every
-- merchant) after statuses are refreshed. Plain up/down moves are left out as
-- noise; promo starts and ends only count from `min_change`. Rows older than
-- `keep_days` are dropped. Returns the number of rows written.
-- ponytail: one threshold for everyone; per-merchant settings (kinds, threshold)
-- when merchants ask for them.
create function record_notifications(matched bigint[] default '{}', min_change numeric default 0.02, keep_days int default 90)
returns int
language plpgsql security invoker set search_path = '' as $$
declare
  day date := (select max(data_date) from public.competitor_listing_price_history);
  moved int;
  done int;
begin
  if day is null then
    return 0;
  end if;

  insert into public.notifications (owner_id, data_date, kind, product_id, listing_id, old_price, new_price)
  select p.owner_id, m.data_date, m.kind, m.product_id, m.listing_id, m.old_price, m.new_price
  from public.price_moves() m
  join public.products p on p.id = m.product_id
  where m.kind in ('undercut', 'raised-above', 'delisted')
     or (m.kind in ('promo-start', 'promo-end') and abs(m.change_ratio) >= min_change)
  order by p.owner_id, m.kind_rank, m.product_name
  on conflict do nothing;
  get diagnostics moved = row_count;

  insert into public.notifications as n (owner_id, data_date, kind, count)
  select p.owner_id, day, 'matched', count(*)
  from public.products p
  where p.id = any(matched)
  group by p.owner_id
  on conflict (owner_id, data_date, kind, product_id, listing_id) do update set
    count = n.count + excluded.count, read_at = null, created_at = now();
  get diagnostics done = row_count;

  delete from public.notifications where data_date < day - keep_days;
  return moved + done;
end;
$$;

-- Pipeline only.
revoke execute on function record_notifications(bigint[], numeric, int) from public, anon, authenticated;
