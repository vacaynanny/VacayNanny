-- Reviewed against the existing public schema. Apply on staging before production.
begin;

-- This trigger uses only pg_catalog built-ins and does not need public in its path.
alter function public.set_updated_at() set search_path = '';

-- These submissions already use service-role server routes with validation and
-- rate limits. Direct Data API inserts would bypass those routes entirely.
drop policy if exists applications_insert_anyone on public.nanny_applications;
drop policy if exists references_insert_anyone on public.nanny_references;
drop policy if exists documents_insert_anyone on public.nanny_documents;
drop policy if exists contact_insert on public.contact_messages;
drop policy if exists waitlist_insert on public.waitlist;
revoke insert on public.nanny_applications, public.nanny_references,
  public.nanny_documents, public.contact_messages, public.waitlist
  from anon, authenticated;

-- Internal trigger functions are invoked by triggers, never by browser RPC calls.
-- Optional functions cover both the platform's RLS trigger and the new guards.
do $$
declare signature text;
begin
  foreach signature in array array[
    'public.handle_new_user()',
    'public.refresh_nanny_rating()',
    'public.set_updated_at()',
    'public.rls_auto_enable()',
    'public.guard_profile_role()',
    'public.guard_booking_payment()',
    'public.guard_nanny_publication()'
  ] loop
    if to_regprocedure(signature) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', signature);
    end if;
  end loop;
end $$;

-- is_admin() and current_role() intentionally retain policy access. Their bodies
-- inspect only auth.uid(), and revoking them would break existing RLS policies.
-- rate_limits intentionally has no client policies: service_role alone consumes it.
commit;
