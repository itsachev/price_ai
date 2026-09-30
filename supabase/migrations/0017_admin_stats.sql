-- Numbers for the admin page in one call: per-merchant catalog counts, the
-- match verdict cache and each chain's freshness. It reads every merchant's
-- data, so only the service role may run it (the admin page checks the role
-- first, then calls it with the service-role client).
create or replace function admin_stats() returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'merchants', coalesce((
      select jsonb_object_agg(owner_id, counts)
      from (
        select owner_id, jsonb_build_object(
          'products',    count(*),
          'competitive', count(*) filter (where price_status = 'competitive'),
          'opportunity', count(*) filter (where price_status = 'opportunity'),
          'at-risk',     count(*) filter (where price_status = 'at-risk'),
          'unmatched',   count(*) filter (where price_status = 'unmatched' and match_key is not null),
          'matching',    count(*) filter (where match_key is null)
        ) as counts
        from public.products
        group by owner_id
      ) m
    ), '{}'::jsonb),
    'verdicts', (
      select jsonb_build_object(
        'confirmed', count(*) filter (where confirmed),
        'rejected',  count(*) filter (where not confirmed),
        'lastDay',   count(*) filter (where judged_at > now() - interval '1 day'),
        'latest',    max(judged_at)
      )
      from public.match_verdicts
    ),
    'chains', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', c.key,
        'name', c.name,
        'listings', l.total,
        'active', l.active,
        'lastSeen', l.last_seen
      ) order by c.name)
      from public.competitors c
      left join lateral (
        select count(*) as total,
               count(*) filter (where captured_at > now() - interval '7 days') as active,
               max(captured_at) as last_seen
        from public.competitor_listings
        where competitor_key = c.key
      ) l on true
    ), '[]'::jsonb)
  );
$$;

revoke execute on function admin_stats() from public, anon, authenticated;
grant execute on function admin_stats() to service_role;
