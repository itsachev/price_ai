-- Catalog management: merchants add, edit and import their own products.

-- A SKU names one product per merchant. NULLs stay distinct, so products
-- without a SKU are allowed any number of times.
alter table products add constraint products_owner_sku unique (owner_id, sku);

-- CSV rows without a SKU are matched to existing products by name, brand and size.
create index on products (owner_id, lower(name));

-- Bulk import from a CSV (called in batches by the importProducts action).
-- Existing products are found by SKU, or by name, brand and size when the row
-- has no SKU, and updated only when something changed; the rest are inserted.
-- So re-importing the same price list is harmless and only changes prices.
-- security invoker: RLS on products applies, and auth.uid() is the caller.
create function import_products(items jsonb)
returns table (inserted int, updated int)
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  with s as (
    select * from jsonb_to_recordset(items) as x(name text, brand text, size text, sku text, price numeric)
  )
  update public.products p
  set name = s.name, brand = s.brand, size = s.size, price = s.price
  from s
  where p.owner_id = uid
    and (p.sku = s.sku or (s.sku is null and p.sku is null and lower(p.name) = lower(s.name)
         and p.brand is not distinct from s.brand and p.size is not distinct from s.size))
    and (p.name, p.brand, p.size, p.price) is distinct from (s.name, s.brand, s.size, s.price);
  get diagnostics updated = row_count;

  with s as (
    select * from jsonb_to_recordset(items) as x(name text, brand text, size text, sku text, price numeric)
  )
  insert into public.products (owner_id, name, brand, size, sku, price)
  select uid, s.name, s.brand, s.size, s.sku, s.price
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
