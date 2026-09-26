-- Cost price (доставна цена): what the merchant pays per unit, so the app can
-- show margin and warn when a suggested price would sell below cost. Optional.
alter table products add column cost numeric(10, 2) check (cost >= 0);

-- import_products learns the cost column. A CSV without costs (null) keeps the
-- stored cost, so re-importing an old price list never wipes it.
create or replace function import_products(items jsonb)
returns table (inserted int, updated int)
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
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
