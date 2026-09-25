-- PriceAI schema.
--
-- Competitor data (competitors, listings, daily prices, scrape runs) is shared:
-- only the scrape pipeline writes it, with the service-role key, which bypasses
-- RLS. Any signed-in merchant can read it.
-- Merchant data (products, their price history and matches) is owned per user
-- through products.owner_id.
-- All money is EUR.

-- ---------------------------------------------------------------------------
-- Competitors
-- ---------------------------------------------------------------------------

-- Keys must match COMPETITORS in src/lib/config.js and each scraper's competitorKey.
create table competitors (
  key  text primary key,
  name text not null
);

insert into competitors (key, name) values
  ('kaufland',   'Kaufland'),
  ('lidl',       'Lidl'),
  ('billa',      'BILLA'),
  ('fantastico', 'Fantastico'),
  ('tmarket',    'T Market'),
  ('metro',      'METRO'),
  ('hitmax',     'Hit Max'),
  ('bulmag',     'BulMag'),
  ('kammarket',  'KAM Market'),
  ('berezka',    'Berezka');

-- One row per chain product code. The upsert key (competitor_key, external_id)
-- keeps ids stable across runs, so matches and history stay attached.
-- price / on_promo are the latest snapshot; history holds every day.
create table competitor_listings (
  id             bigint generated always as identity primary key,
  competitor_key text not null references competitors (key),
  external_id    text not null,
  title          text not null,
  brand          text,
  size           text,
  category_code  integer,          -- KZP category, which encodes pack size
  price          numeric(10, 2) not null check (price > 0),
  on_promo       boolean not null default false,
  url            text,
  captured_at    timestamptz not null default now(),  -- last run that saw it
  unique (competitor_key, external_id)
);

create index on competitor_listings (competitor_key, category_code);

-- One row per listing per data date (the date the feed describes, not the run
-- date). KZP sends one row per store; they are aggregated here to the typical
-- (most common) effective price, plus the min/max across stores.
-- No cascade: deleting a listing that has history fails, so history is never
-- lost by accident. Delisted products should simply stop getting new rows.
create table competitor_listing_price_history (
  listing_id    bigint not null references competitor_listings (id),
  data_date     date not null,
  price         numeric(10, 2) not null check (price > 0),  -- typical effective price
  regular_price numeric(10, 2) check (regular_price > 0),   -- typical price before promo
  min_price     numeric(10, 2),
  max_price     numeric(10, 2),
  on_promo      boolean not null default false,
  promo_ends_on date,
  store_count   integer,
  captured_at   timestamptz not null default now(),
  primary key (listing_id, data_date)
);

-- ---------------------------------------------------------------------------
-- Scrape run health log (written by scrapeAll)
-- ---------------------------------------------------------------------------

create table scrape_runs (
  id           bigint generated always as identity primary key,
  started_at   timestamptz not null,
  finished_at  timestamptz not null default now(),
  total_count  integer not null,
  ok_count     integer not null,
  failed_count integer not null
);

create table scrape_run_results (
  run_id         bigint not null references scrape_runs (id) on delete cascade,
  competitor_key text not null references competitors (key),
  ok             boolean not null,
  listing_count  integer,
  pruned_count   integer,
  error_message  text,
  primary key (run_id, competitor_key)
);

-- ---------------------------------------------------------------------------
-- Merchant catalog
-- ---------------------------------------------------------------------------

create table products (
  id            bigint generated always as identity primary key,
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  brand         text,
  size          text,
  sku           text,
  category_code integer,
  price         numeric(10, 2) not null check (price > 0),
  price_status  text not null default 'unmatched'
                check (price_status in ('competitive', 'opportunity', 'at-risk', 'unmatched')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index on products (owner_id);

create table product_price_history (
  id          bigint generated always as identity primary key,
  product_id  bigint not null references products (id) on delete cascade,
  price       numeric(10, 2) not null,
  recorded_at timestamptz not null default now()
);

create index on product_price_history (product_id, recorded_at);

-- Written by the match pipeline (service role). Rejected pairs are kept too, so
-- Gemini is not asked about the same pair twice.
create table product_matches (
  product_id bigint not null references products (id) on delete cascade,
  listing_id bigint not null references competitor_listings (id) on delete cascade,
  confirmed  boolean not null,
  confidence real check (confidence between 0 and 1),
  reason     text,
  matched_at timestamptz not null default now(),
  primary key (product_id, listing_id)
);

create index on product_matches (listing_id);

-- Keep updated_at current and record every price the merchant sets, in the
-- database so no code path can forget it.
create function products_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_touch
  before update on products
  for each row execute function products_touch();

-- security definer: merchants have no insert policy on the history table.
create function products_log_price() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.product_price_history (product_id, price) values (new.id, new.price);
  end if;
  return null;
end;
$$;

create trigger products_log_price
  after insert or update of price on products
  for each row execute function products_log_price();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table competitors                      enable row level security;
alter table competitor_listings              enable row level security;
alter table competitor_listing_price_history enable row level security;
alter table scrape_runs                      enable row level security;
alter table scrape_run_results               enable row level security;
alter table products                         enable row level security;
alter table product_price_history            enable row level security;
alter table product_matches                  enable row level security;

-- Shared competitor data: read-only for signed-in users.
create policy "read" on competitors                      for select to authenticated using (true);
create policy "read" on competitor_listings              for select to authenticated using (true);
create policy "read" on competitor_listing_price_history for select to authenticated using (true);
create policy "read" on scrape_runs                      for select to authenticated using (true);
create policy "read" on scrape_run_results               for select to authenticated using (true);

-- Merchants manage their own products.
create policy "own products" on products for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- History (written by the trigger) and matches (written by the pipeline) are
-- read-only for the owner.
create policy "own history" on product_price_history for select to authenticated
  using (exists (select 1 from products p where p.id = product_id and p.owner_id = (select auth.uid())));

create policy "own matches" on product_matches for select to authenticated
  using (exists (select 1 from products p where p.id = product_id and p.owner_id = (select auth.uid())));
