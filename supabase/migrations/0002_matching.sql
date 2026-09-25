-- Matching: Gemini verdicts are cached per normalized product text instead of
-- per product row, so merchants who sell the same product share one verdict,
-- and a renamed product gets fresh verdicts instead of stale ones.
-- product_matches becomes a view over that cache.

drop table product_matches;

-- Written by the match pipeline: normalized name|brand|size. Cleared when the
-- merchant changes any of those, so the product is matched again.
alter table products add column match_key text;
create index on products (match_key);

-- Every verdict is kept, rejected pairs included, so no pair is judged twice.
create table match_verdicts (
  match_key  text not null,
  listing_id bigint not null references competitor_listings (id),
  confirmed  boolean not null,
  confidence real check (confidence between 0 and 1),
  reason     text,
  model      text,
  judged_at  timestamptz not null default now(),
  primary key (match_key, listing_id)
);

create index on match_verdicts (listing_id);

alter table match_verdicts enable row level security;

-- A merchant may read verdicts only for keys of their own products, so other
-- merchants' catalogs stay private.
create policy "own verdicts" on match_verdicts for select to authenticated
  using (exists (
    select 1 from products p
    where p.match_key = match_verdicts.match_key and p.owner_id = (select auth.uid())
  ));

-- security_invoker: the caller's RLS on products and match_verdicts applies.
create view product_matches with (security_invoker = true) as
  select p.id as product_id, v.listing_id, v.confirmed, v.confidence, v.reason, v.judged_at
  from products p
  join match_verdicts v on v.match_key = p.match_key;

create or replace function products_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if (new.name, new.brand, new.size) is distinct from (old.name, old.brand, old.size) then
    new.match_key := null;
    new.price_status := 'unmatched';
  end if;
  return new;
end;
$$;
