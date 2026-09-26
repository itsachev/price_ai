-- Possible matches: when Gemini rejects a pair but the listing could still be
-- the merchant's product (their text is too vague to be sure, e.g. no fat % or
-- size), the verdict is flagged `possible` and shown as a suggestion. A merchant
-- who accepts one gets a per-product link that counts like a confirmed match.

-- null = judged before this column existed; the pipeline asks such pairs again.
alter table match_verdicts add column possible boolean;

-- Per merchant, unlike match_verdicts (shared across merchants by match_key).
create table product_links (
  product_id bigint not null references products (id) on delete cascade,
  listing_id bigint not null references competitor_listings (id),
  created_at timestamptz not null default now(),
  primary key (product_id, listing_id)
);

create index on product_links (listing_id);

alter table product_links enable row level security;

create policy "own links" on product_links for all to authenticated
  using (exists (select 1 from products p where p.id = product_links.product_id and p.owner_id = (select auth.uid())))
  with check (exists (select 1 from products p where p.id = product_links.product_id and p.owner_id = (select auth.uid())));

-- A renamed or resized product is a different product: drop its manual links
-- along with its verdicts.
create or replace function products_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if (new.name, new.brand, new.size) is distinct from (old.name, old.brand, old.size) then
    new.match_key := null;
    new.price_status := 'unmatched';
    delete from public.product_links where product_id = new.id;
  end if;
  return new;
end;
$$;

-- Same as 0003, plus manual links as matches and a count of open suggestions.
drop function product_overview(int);

create function product_overview(active_days int default 7)
returns table (
  id               bigint,
  name             text,
  brand            text,
  size             text,
  price            numeric,
  price_status     text,
  status_rank      int,      -- at-risk first, unmatched last
  best_price       numeric,
  best_competitor  text,
  best_on_promo    boolean,
  chain_count      int,
  gap              numeric,  -- merchant price minus cheapest; positive = pricier
  gap_ratio        numeric,
  urgency          numeric,  -- abs(gap_ratio), sorts the biggest gaps first
  suggestion_count int       -- possible, still-listed, not yet linked
)
language sql stable security invoker set search_path = '' as $$
  select
    p.id, p.name, p.brand, p.size, p.price, p.price_status,
    array_position(array['at-risk', 'opportunity', 'competitive', 'unmatched'], p.price_status),
    b.price, b.competitor_key, b.on_promo, b.chains::int,
    p.price - b.price,
    round((p.price - b.price) / b.price, 4),
    abs(round((p.price - b.price) / b.price, 4)),
    s.n::int
  from public.products p
  left join lateral (
    select min(l.price) as price,
           (array_agg(l.competitor_key order by l.price, l.competitor_key))[1] as competitor_key,
           (array_agg(l.on_promo order by l.price, l.competitor_key))[1] as on_promo,
           count(distinct l.competitor_key) as chains
    from (
      select v.listing_id from public.match_verdicts v where v.match_key = p.match_key and v.confirmed
      union
      select k.listing_id from public.product_links k where k.product_id = p.id
    ) m
    join public.competitor_listings l on l.id = m.listing_id
    where l.captured_at >= now() - make_interval(days => active_days)
  ) b on true
  left join lateral (
    select count(*) as n
    from public.match_verdicts v
    join public.competitor_listings l on l.id = v.listing_id
    where v.match_key = p.match_key
      and v.possible
      and l.captured_at >= now() - make_interval(days => active_days)
      and not exists (select 1 from public.product_links k where k.product_id = p.id and k.listing_id = v.listing_id)
  ) s on true
$$;
