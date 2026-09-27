-- Pricing rules: how the merchant wants suggested prices shaped. One row per
-- merchant; no row, or a null column, means the rule is off. Ratios are 0..1.
--   min_margin  gross margin on the selling price never goes below this (needs a cost)
--   undercut    euros under the cheapest chain (0 = match it)
--   max_change  one suggestion moves the price by at most this share of today's price
-- ponytail: one set per merchant; add a nullable category_code column (and pick the
-- most specific row) when merchants ask for per-category rules.
create table pricing_rules (
  owner_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  min_margin  numeric(5, 4) check (min_margin >= 0 and min_margin < 1),
  undercut    numeric(10, 2) not null default 0 check (undercut >= 0),
  max_change  numeric(5, 4) check (max_change > 0 and max_change <= 1),
  updated_at  timestamptz not null default now()
);

alter table pricing_rules enable row level security;

create policy "own rules" on pricing_rules for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
