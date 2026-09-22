-- Run this in the Supabase SQL editor on an existing VacayNanny project.
-- New installs get the same objects from schema.sql.

alter table public.nannies
  add column if not exists safeguarding_completed_at timestamptz;

create table if not exists public.booking_messages (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  sender_id    uuid references public.profiles(id) on delete set null,
  sender_role  text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);

alter table public.booking_messages drop constraint if exists booking_messages_role_check;
alter table public.booking_messages
  add constraint booking_messages_role_check
  check (sender_role in ('parent', 'nanny', 'admin'));

alter table public.booking_messages drop constraint if exists booking_messages_body_check;
alter table public.booking_messages
  add constraint booking_messages_body_check
  check (char_length(trim(body)) between 1 and 2000);

create index if not exists booking_messages_booking_idx
  on public.booking_messages (booking_id, created_at);

alter table public.booking_messages enable row level security;

drop policy if exists "booking_messages_select_involved" on public.booking_messages;
create policy "booking_messages_select_involved" on public.booking_messages
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and (
          b.parent_id = auth.uid()
          or b.nanny_id in (select id from public.nannies where user_id = auth.uid())
        )
    )
  );

drop policy if exists "booking_messages_insert_involved" on public.booking_messages;
create policy "booking_messages_insert_involved" on public.booking_messages
  for insert with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.bookings b
        where b.id = booking_id
          and b.status in ('matched', 'confirmed', 'in_progress', 'completed')
          and (
            b.parent_id = auth.uid()
            or b.nanny_id in (select id from public.nannies where user_id = auth.uid())
          )
      )
    )
  );
