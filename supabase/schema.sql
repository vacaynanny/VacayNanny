-- VacayNanny full-stack schema
-- Run this in the Supabase SQL editor (or via supabase db push).
-- After the first admin signs up:
--   update public.profiles set role = 'admin' where email = 'you@email.com';

create extension if not exists "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────────────────

do $$ begin
  create type public.user_role as enum ('parent', 'nanny', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nanny_tier as enum ('bronze', 'silver', 'gold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_status as enum (
    'pending', 'reviewing', 'interview', 'approved', 'rejected'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.booking_status as enum (
    'pending', 'matched', 'confirmed', 'in_progress', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_kind as enum (
    'photo', 'id_front', 'id_back', 'selfie', 'cogc', 'passport', 'certificate'
  );
exception when duplicate_object then null; end $$;

-- ── Profiles (1:1 with auth.users) ───────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null default 'parent',
  full_name   text not null default '',
  email       text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_email_idx on public.profiles(email);

-- ── Destinations ─────────────────────────────────────────────────────────────

create table if not exists public.destinations (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  country     text not null,
  image_url   text,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ── Nanny applications ───────────────────────────────────────────────────────

create table if not exists public.nanny_applications (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles(id) on delete set null,
  full_name             text not null,
  date_of_birth         date,
  phone                 text,
  country_code          text,
  email                 text not null,
  gender                text,
  languages             text[] not null default '{}',
  county                text,
  town                  text,
  national_id_number    text,
  kra_pin               text,
  cogc_status           text,
  cogc_date             date,
  experience_years      text,
  age_groups            text[] not null default '{}',
  services              text[] not null default '{}',
  bio                   text,
  certifications        text[] not null default '{}',
  swimming              text,
  cooking               text,
  tutoring              text,
  driving               text,
  special_needs         text,
  available_days        text[] not null default '{}',
  earliest_start        text,
  latest_end            text,
  willing_to_travel     text,
  preferred_locations   text[] not null default '{}',
  comfortable_pets      text,
  comfortable_multiple  text,
  estimated_tier        public.nanny_tier not null default 'bronze',
  status                public.application_status not null default 'pending',
  admin_notes           text,
  consent_background    boolean not null default false,
  consent_terms         boolean not null default false,
  consent_accuracy      boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists nanny_applications_status_idx on public.nanny_applications(status);
create index if not exists nanny_applications_email_idx on public.nanny_applications(email);

-- ── References on an application ─────────────────────────────────────────────

create table if not exists public.nanny_references (
  id                    uuid primary key default gen_random_uuid(),
  application_id        uuid not null references public.nanny_applications(id) on delete cascade,
  full_name             text not null,
  relationship          text,
  employer              text,
  phone                 text,
  email                 text,
  country_code          text,
  permission_to_contact text,
  sort_order            int not null default 1
);

create index if not exists nanny_references_app_idx on public.nanny_references(application_id);

-- ── Uploaded documents (paths in Storage) ────────────────────────────────────

create table if not exists public.nanny_documents (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid references public.nanny_applications(id) on delete cascade,
  nanny_id        uuid,
  kind            public.document_kind not null,
  storage_path    text not null,
  file_name       text,
  mime_type       text,
  created_at      timestamptz not null default now()
);

create index if not exists nanny_documents_app_idx on public.nanny_documents(application_id);

-- ── Live nanny profiles (created when an application is approved) ────────────

create table if not exists public.nannies (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique references public.profiles(id) on delete set null,
  application_id    uuid unique references public.nanny_applications(id) on delete set null,
  slug              text unique not null,
  display_name      text not null,
  photo_url         text,
  bio               text,
  tier              public.nanny_tier not null default 'bronze',
  daily_rate_kes    int not null default 2200,
  county            text,
  town              text,
  destinations      text[] not null default '{}',
  languages         text[] not null default '{}',
  age_groups        text[] not null default '{}',
  services          text[] not null default '{}',
  certifications    text[] not null default '{}',
  tags              text[] not null default '{}',
  available_days    text[] not null default '{}',
  willing_to_travel text,
  is_active         boolean not null default true,
  rating_avg        numeric(3,2) not null default 5.00,
  review_count      int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists nannies_active_idx on public.nannies(is_active);
create index if not exists nannies_tier_idx on public.nannies(tier);
create index if not exists nannies_destinations_idx on public.nannies using gin (destinations);

alter table public.nanny_documents
  drop constraint if exists nanny_documents_nanny_id_fkey;
alter table public.nanny_documents
  add constraint nanny_documents_nanny_id_fkey
  foreign key (nanny_id) references public.nannies(id) on delete set null;

-- ── Bookings ─────────────────────────────────────────────────────────────────

create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  parent_id         uuid references public.profiles(id) on delete set null,
  nanny_id          uuid references public.nannies(id) on delete set null,
  parent_name       text not null,
  email             text not null,
  phone             text,
  destination       text not null,
  check_in          date not null,
  check_out         date not null,
  children_count    text,
  youngest_age      text,
  nannies_needed    text not null default '1',
  tier              text,
  notes             text,
  status            public.booking_status not null default 'pending',
  total_amount_kes  int,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists bookings_status_idx on public.bookings(status);
create index if not exists bookings_parent_idx on public.bookings(parent_id);
create index if not exists bookings_nanny_idx on public.bookings(nanny_id);
create index if not exists bookings_email_idx on public.bookings(email);

-- ── Reviews ──────────────────────────────────────────────────────────────────

create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references public.bookings(id) on delete set null,
  nanny_id      uuid not null references public.nannies(id) on delete cascade,
  parent_name   text not null,
  trip_label    text,
  rating        int not null check (rating between 1 and 5),
  body          text not null,
  avatar_url    text,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists reviews_nanny_idx on public.reviews(nanny_id);

-- ── Waitlist & contact ───────────────────────────────────────────────────────

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  region      text,
  created_at  timestamptz not null default now()
);

create unique index if not exists waitlist_email_region_idx
  on public.waitlist (lower(email), coalesce(region, ''));

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  subject     text,
  message     text not null,
  created_at  timestamptz not null default now()
);

-- ── updated_at helper ────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists nanny_applications_updated_at on public.nanny_applications;
create trigger nanny_applications_updated_at before update on public.nanny_applications
  for each row execute function public.set_updated_at();

drop trigger if exists nannies_updated_at on public.nannies;
create trigger nannies_updated_at before update on public.nannies
  for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ── Auto-create a profile when a user signs up ───────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(
      case
        when new.raw_user_meta_data->>'role' in ('parent', 'nanny')
          then (new.raw_user_meta_data->>'role')::public.user_role
        else 'parent'::public.user_role
      end,
      'parent'::public.user_role
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep review aggregates in sync
create or replace function public.refresh_nanny_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  target := coalesce(new.nanny_id, old.nanny_id);
  update public.nannies n
  set
    rating_avg = coalesce((
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.nanny_id = target and r.is_published
    ), 5.00),
    review_count = (
      select count(*) from public.reviews r
      where r.nanny_id = target and r.is_published
    )
  where n.id = target;
  return coalesce(new, old);
end $$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_nanny_rating();

-- ── Role helpers ─────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.destinations enable row level security;
alter table public.nanny_applications enable row level security;
alter table public.nanny_references enable row level security;
alter table public.nanny_documents enable row level security;
alter table public.nannies enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.waitlist enable row level security;
alter table public.contact_messages enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id and role = (select p.role from public.profiles p where p.id = auth.uid()));

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- destinations: public read
drop policy if exists "destinations_public_read" on public.destinations;
create policy "destinations_public_read" on public.destinations
  for select using (is_active or public.is_admin());

drop policy if exists "destinations_admin_write" on public.destinations;
create policy "destinations_admin_write" on public.destinations
  for all using (public.is_admin()) with check (public.is_admin());

-- nannies: public read of live profiles
drop policy if exists "nannies_public_read" on public.nannies;
create policy "nannies_public_read" on public.nannies
  for select using (is_active or public.is_admin() or user_id = auth.uid());

drop policy if exists "nannies_self_update" on public.nannies;
create policy "nannies_self_update" on public.nannies
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "nannies_admin_write" on public.nannies;
create policy "nannies_admin_write" on public.nannies
  for all using (public.is_admin()) with check (public.is_admin());

-- applications: anyone can insert (guest apply); owner/admin can read
drop policy if exists "applications_insert_anyone" on public.nanny_applications;
create policy "applications_insert_anyone" on public.nanny_applications
  for insert with check (true);

drop policy if exists "applications_select_own" on public.nanny_applications;
create policy "applications_select_own" on public.nanny_applications
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "applications_admin_update" on public.nanny_applications;
create policy "applications_admin_update" on public.nanny_applications
  for update using (public.is_admin()) with check (public.is_admin());

-- references / documents: insert with application, admin read
drop policy if exists "references_insert_anyone" on public.nanny_references;
create policy "references_insert_anyone" on public.nanny_references
  for insert with check (true);

drop policy if exists "references_select_admin" on public.nanny_references;
create policy "references_select_admin" on public.nanny_references
  for select using (public.is_admin());

drop policy if exists "documents_insert_anyone" on public.nanny_documents;
create policy "documents_insert_anyone" on public.nanny_documents
  for insert with check (true);

drop policy if exists "documents_select_admin" on public.nanny_documents;
create policy "documents_select_admin" on public.nanny_documents
  for select using (public.is_admin());

-- bookings: guest insert, parent sees own, nanny sees assigned, admin all
drop policy if exists "bookings_insert_anyone" on public.bookings;
create policy "bookings_insert_anyone" on public.bookings
  for insert with check (true);

drop policy if exists "bookings_select_involved" on public.bookings;
create policy "bookings_select_involved" on public.bookings
  for select using (
    public.is_admin()
    or parent_id = auth.uid()
    or nanny_id in (select id from public.nannies where user_id = auth.uid())
  );

drop policy if exists "bookings_update_admin" on public.bookings;
create policy "bookings_update_admin" on public.bookings
  for update using (public.is_admin()) with check (public.is_admin());

-- reviews: public published, admin write
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
  for select using (is_published or public.is_admin());

drop policy if exists "reviews_admin_write" on public.reviews;
create policy "reviews_admin_write" on public.reviews
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reviews_parent_insert" on public.reviews;
create policy "reviews_parent_insert" on public.reviews
  for insert with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.parent_id = auth.uid()
        and b.status = 'completed'
    )
  );

-- waitlist + contact: public insert, admin read
drop policy if exists "waitlist_insert" on public.waitlist;
create policy "waitlist_insert" on public.waitlist
  for insert with check (true);

drop policy if exists "waitlist_admin_read" on public.waitlist;
create policy "waitlist_admin_read" on public.waitlist
  for select using (public.is_admin());

drop policy if exists "contact_insert" on public.contact_messages;
create policy "contact_insert" on public.contact_messages
  for insert with check (true);

drop policy if exists "contact_admin_read" on public.contact_messages;
create policy "contact_admin_read" on public.contact_messages
  for select using (public.is_admin());

-- ── Storage buckets ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('nanny-photos', 'nanny-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('nanny-documents', 'nanny-documents', false)
on conflict (id) do nothing;

drop policy if exists "nanny_photos_public_read" on storage.objects;
create policy "nanny_photos_public_read" on storage.objects
  for select using (bucket_id = 'nanny-photos');

drop policy if exists "nanny_photos_admin_write" on storage.objects;
create policy "nanny_photos_admin_write" on storage.objects
  for all using (bucket_id = 'nanny-photos' and public.is_admin())
  with check (bucket_id = 'nanny-photos' and public.is_admin());

drop policy if exists "nanny_documents_admin_read" on storage.objects;
create policy "nanny_documents_admin_read" on storage.objects
  for select using (bucket_id = 'nanny-documents' and public.is_admin());

drop policy if exists "nanny_documents_admin_write" on storage.objects;
create policy "nanny_documents_admin_write" on storage.objects
  for all using (bucket_id = 'nanny-documents' and public.is_admin())
  with check (bucket_id = 'nanny-documents' and public.is_admin());

-- Service-role uploads from Next.js API routes bypass RLS.
-- Anon/authenticated clients cannot write identity documents directly.
