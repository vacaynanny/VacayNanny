-- Apply after the existing schema/catalog/lifecycle migrations, on staging first.
begin;

-- Existing bookings and requests from the old deployed API keep their historical arrangement.
-- The refreshed booking API explicitly writes unpaid. payment_cutover.sql changes the default
-- only when the refreshed app, merchant configuration and agreement document are ready.
alter table public.bookings add column if not exists payment_status text not null default 'not_required';
alter table public.bookings add column if not exists paid_at timestamptz;
alter table public.bookings add column if not exists guest_access_token_hash text;
alter table public.bookings drop constraint if exists bookings_payment_status_check;
alter table public.bookings add constraint bookings_payment_status_check check (payment_status in ('unpaid','paid','not_required','refund_pending','refunded'));

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  reference text not null unique,
  amount_subunit bigint not null check (amount_subunit >= 300),
  currency text not null default 'KES' check (currency = 'KES'),
  status text not null default 'pending' check (status in ('pending','success','failed')),
  authorization_url text,
  channel text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists payment_one_pending_per_booking on public.payment_attempts(booking_id) where status = 'pending';
-- Keep every verified transaction, including unexpected duplicate or late collections for review.
alter table public.payment_attempts enable row level security;
-- All reads/writes go through authorized server routes; no public payment records.
revoke all on public.payment_attempts from anon, authenticated;
grant all on public.payment_attempts to service_role;
drop policy if exists bookings_insert_anyone on public.bookings;
-- Booking creation must use the server API: direct inserts could forge a paid booking.
revoke insert on public.bookings from anon, authenticated;
revoke insert, update, delete on public.nannies from anon, authenticated;
revoke insert, update, delete on public.nanny_applications from anon, authenticated;

create or replace function public.create_booking_payment(p_booking_id uuid, p_reference text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.bookings; a public.payment_attempts;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found.'; end if;
  if b.payment_status <> 'unpaid' then raise exception 'This booking does not need another payment.'; end if;
  if (b.check_in::timestamp at time zone 'Africa/Nairobi') <= now() then raise exception 'Care has started. Please contact support before paying.'; end if;
  if b.parent_confirmed_at is null or b.nanny_id is null or b.nanny_response is distinct from 'accepted' or b.status <> 'confirmed' then
    raise exception 'Accept the nanny match before paying. Your nanny must also accept.';
  end if;
  if b.total_amount_kes is null or b.total_amount_kes < 3 or round(b.total_amount_kes*100)>9007199254740991 then raise exception 'A published booking total is required.'; end if;
  select * into a from public.payment_attempts where booking_id=b.id and status='pending';
  if found then return to_jsonb(a); end if;
  insert into public.payment_attempts(booking_id,reference,amount_subunit) values(b.id,p_reference,round(b.total_amount_kes*100)::bigint) returning * into a;
  return to_jsonb(a) || jsonb_build_object('initialize',true);
end $$;

create or replace function public.settle_booking_payment(p_reference text,p_amount bigint,p_currency text,p_channel text,p_paid_at timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare a public.payment_attempts; b public.bookings;
begin
  -- Always lock booking before attempt, matching checkout and mutation lock order.
  select * into a from public.payment_attempts where reference=p_reference;
  if not found then raise exception 'Unknown payment reference.'; end if;
  select * into b from public.bookings where id=a.booking_id for update;
  select * into a from public.payment_attempts where reference=p_reference for update;
  if a.amount_subunit <> p_amount or a.currency <> p_currency then raise exception 'Payment amount or currency mismatch.'; end if;
  if a.status='success' then return; end if;
  update public.payment_attempts set status='success',channel=p_channel,paid_at=p_paid_at where id=a.id;
  -- Preserve a late successful payment on a cancelled booking for manual refund review.
  update public.bookings set payment_status=case when status='cancelled' or payment_status in ('paid','refund_pending') then 'refund_pending' else 'paid' end,paid_at=p_paid_at where id=b.id;
end $$;
revoke all on function public.create_booking_payment(uuid,text) from public,anon,authenticated;
revoke all on function public.settle_booking_payment(text,bigint,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.create_booking_payment(uuid,text) to service_role;
grant execute on function public.settle_booking_payment(text,bigint,text,text,timestamptz) to service_role;

-- Prevent a price/date change while money is pending or already collected.
create or replace function public.guard_booking_payment() returns trigger language plpgsql set search_path=public as $$
begin
  if (new.total_amount_kes is distinct from old.total_amount_kes or new.check_in is distinct from old.check_in or new.check_out is distinct from old.check_out)
     and (old.payment_status in ('paid','refund_pending') or exists(select 1 from public.payment_attempts where booking_id=old.id and status='pending')) then
    raise exception 'Contact support to change a booking with a pending or completed payment.';
  end if;
  if new.status in ('in_progress','completed') and old.status not in ('in_progress','completed') and new.payment_status not in ('paid','not_required') then
    raise exception 'Payment is required before care can start.';
  end if;
  if new.status='cancelled' and old.payment_status='paid' then new.payment_status='refund_pending'; end if;
  return new;
end $$;
drop trigger if exists guard_booking_payment on public.bookings;
create trigger guard_booking_payment before update on public.bookings for each row execute function public.guard_booking_payment();

alter table public.nanny_applications add column if not exists agreement_signed_path text;
alter table public.nanny_applications add column if not exists agreement_reviewed_at timestamptz;
alter table public.nanny_applications add column if not exists agreement_reviewed_by uuid references public.profiles(id);
alter table public.nanny_applications add column if not exists approval_email_sent_at timestamptz;

create or replace function public.guard_nanny_publication() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.is_active and (tg_op='INSERT' or not old.is_active) then
    if not exists(select 1 from public.nanny_applications a where a.id=new.application_id and a.status='approved' and a.agreement_signed_path is not null and a.agreement_reviewed_at is not null and a.agreement_reviewed_by is not null) then
      raise exception 'Approve the application and review the signed agreement before publishing.';
    end if;
  end if;
  return new;
end $$;
-- Install the publication trigger at application cutover. The new server APIs also
-- validate approval and signed agreement review before publishing a profile.

-- A user must never promote their own role through the Supabase REST API.
create or replace function public.guard_profile_role() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role and current_user not in ('service_role','postgres','supabase_admin') then
    raise exception 'Role changes must use the authorized admin API.';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role before update on public.profiles for each row execute function public.guard_profile_role();
commit;
