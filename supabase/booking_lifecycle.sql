-- Run this in the Supabase SQL editor on an existing VacayNanny project.
-- New installs get the same columns from schema.sql.

alter table public.bookings add column if not exists care_type text not null default 'standard';
alter table public.bookings add column if not exists parent_confirmed_at timestamptz;
alter table public.bookings add column if not exists nanny_response text;
alter table public.bookings add column if not exists nanny_responded_at timestamptz;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists cancellation_reason text;
alter table public.bookings add column if not exists refund_percent int;
alter table public.bookings add column if not exists replacement_requested_at timestamptz;
alter table public.bookings add column if not exists replacement_fulfilled_at timestamptz;
alter table public.bookings add column if not exists replaced_nanny_id uuid;

alter table public.bookings drop constraint if exists bookings_care_type_check;
alter table public.bookings
  add constraint bookings_care_type_check
  check (care_type in ('standard', 'extended', 'overnight'));

alter table public.bookings drop constraint if exists bookings_nanny_response_check;
alter table public.bookings
  add constraint bookings_nanny_response_check
  check (nanny_response is null or nanny_response in ('pending', 'accepted', 'declined'));

alter table public.bookings drop constraint if exists bookings_replaced_nanny_id_fkey;
alter table public.bookings
  add constraint bookings_replaced_nanny_id_fkey
  foreign key (replaced_nanny_id) references public.nannies(id) on delete set null;
