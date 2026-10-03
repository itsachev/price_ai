-- A shopper's list: listings picked in the price finder (/info). Equivalents in
-- other chains are found at read time by the listing's KZP category (which
-- encodes pack size), so the list page can total the basket per chain.
-- No cascade on the listing: listings are never deleted.
create table shopping_list_items (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  listing_id bigint not null references competitor_listings (id),
  quantity   smallint not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

alter table shopping_list_items enable row level security;

create policy "own rows" on shopping_list_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
