-- Run this in the Supabase SQL editor on an existing VacayNanny project.
-- New installs get the same objects from schema.sql.
-- Apply, booking, contact, and waitlist rate limits share this table.
-- Until it exists, those routes fall back to a per-instance limit.

create table if not exists public.rate_limits (
  bucket text primary key,
  hits integer not null,
  window_start timestamptz not null
);

alter table public.rate_limits enable row level security;

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hits integer;
begin
  if p_bucket is null or char_length(p_bucket) < 1 or char_length(p_bucket) > 200 then
    return false;
  end if;
  if p_limit < 1 or p_limit > 1000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.rate_limits (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set
      hits = case
        when public.rate_limits.window_start + make_interval(secs => p_window_seconds) <= now() then 1
        else public.rate_limits.hits + 1
      end,
      window_start = case
        when public.rate_limits.window_start + make_interval(secs => p_window_seconds) <= now() then now()
        else public.rate_limits.window_start
      end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, integer, integer) from anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
