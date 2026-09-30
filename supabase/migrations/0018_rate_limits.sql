-- Rate limits for the auth forms. Server actions call Supabase from the app
-- server, so Supabase's own per-IP limits see one IP for every visitor; this
-- counts per visitor IP and per (hashed) email instead. Fixed window per key.
-- Only the service role may touch it: anyone else could lock out other keys.
create table rate_limits (
  key          text primary key,   -- '<form>:<ip|email hash>'
  hits         int not null,
  window_start timestamptz not null
);
alter table rate_limits enable row level security; -- no policies: service role only
revoke all on rate_limits from anon, authenticated;

-- One hit on `key`; true while it stays within `max_hits` per `window_seconds`.
create or replace function rate_limit(key text, max_hits int, window_seconds int) returns boolean
language plpgsql set search_path = '' as $$
declare
  n int;
begin
  insert into public.rate_limits as r (key, hits, window_start)
  values (rate_limit.key, 1, now())
  on conflict on constraint rate_limits_pkey do update set
    hits         = case when r.window_start < now() - make_interval(secs => window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => window_seconds) then now() else r.window_start end
  returning hits into n;
  -- Expired windows are dead weight; sweep them now and then instead of on a schedule.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= max_hits;
end $$;

revoke all on function rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function rate_limit(text, int, int) to service_role;
