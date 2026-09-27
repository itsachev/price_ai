-- Where each price change came from, so Reports can show what the merchant's
-- actions earned: 'apply' (a suggested price), 'csv' (an import) or 'manual'
-- (typed in, and every row before this migration).
alter table product_price_history
  add column source text not null default 'manual' check (source in ('manual', 'apply', 'csv'));

-- The writer names the source in a transaction-local setting (apply_price,
-- import_products); a plain update from the edit form falls back to 'manual'.
-- So the trigger stays the one place history is written.
create or replace function products_log_price() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.product_price_history (product_id, price, source)
    values (new.id, new.price, coalesce(nullif(current_setting('priceai.price_source', true), ''), 'manual'));
  end if;
  return null;
end;
$$;

-- "Apply" on a suggested price. security invoker: RLS on products applies.
create function apply_price(product_id bigint, new_price numeric)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('priceai.price_source', 'apply', true);
  update public.products set price = new_price where id = product_id;
  if not found then
    raise exception 'product % not found', product_id using errcode = 'P0002';
  end if;
end;
$$;

-- import_products tags its price changes as 'csv'; otherwise as in 0006.
create or replace function import_products(items jsonb)
returns table (inserted int, updated int)
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  perform set_config('priceai.price_source', 'csv', true);

  with s as (
    select * from jsonb_to_recordset(items) as x(name text, brand text, size text, sku text, price numeric, cost numeric)
  )
  update public.products p
  set name = s.name, brand = s.brand, size = s.size, price = s.price, cost = coalesce(s.cost, p.cost)
  from s
  where p.owner_id = uid
    and (p.sku = s.sku or (s.sku is null and p.sku is null and lower(p.name) = lower(s.name)
         and p.brand is not distinct from s.brand and p.size is not distinct from s.size))
    and (p.name, p.brand, p.size, p.price, p.cost) is distinct from (s.name, s.brand, s.size, s.price, coalesce(s.cost, p.cost));
  get diagnostics updated = row_count;

  with s as (
    select * from jsonb_to_recordset(items) as x(name text, brand text, size text, sku text, price numeric, cost numeric)
  )
  insert into public.products (owner_id, name, brand, size, sku, price, cost)
  select uid, s.name, s.brand, s.size, s.sku, s.price, s.cost
  from s
  where not exists (
    select 1 from public.products p
    where p.owner_id = uid
      and (p.sku = s.sku or (s.sku is null and p.sku is null and lower(p.name) = lower(s.name)
           and p.brand is not distinct from s.brand and p.size is not distinct from s.size))
  );
  get diagnostics inserted = row_count;

  return next;
end;
$$;
