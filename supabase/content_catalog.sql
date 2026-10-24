-- Pricing, policies, FAQs, and homepage steps.
-- Run after supabase/schema.sql. Safe to re-run: seeds do not overwrite edits.

create table if not exists public.pricing_tiers (
  code            text primary key,
  label           text not null,
  card_title      text not null,
  badge           text not null default '',
  description     text not null default '',
  period          text not null default '',
  daily_rate_kes  integer not null check (daily_rate_kes >= 0),
  features        text[] not null default '{}',
  cta             text not null default 'Book',
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  updated_at      timestamptz not null default now(),
  constraint pricing_tiers_code_check check (code in ('bronze', 'silver', 'gold'))
);

create table if not exists public.care_offerings (
  code         text primary key,
  label        text not null,
  hours        integer not null check (hours > 0),
  multiplier   numeric not null check (multiplier > 0),
  hint         text not null default '',
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now(),
  constraint care_offerings_code_check check (code in ('standard', 'extended', 'overnight'))
);

create table if not exists public.pricing_addons (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  description   text not null default '',
  amount_kes    integer check (amount_kes is null or amount_kes >= 0),
  pricing_mode  text not null default 'flat',
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now(),
  constraint pricing_addons_mode_check check (pricing_mode in ('flat', 'custom'))
);

create table if not exists public.faqs (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists public.homepage_steps (
  id          uuid primary key default gen_random_uuid(),
  step_label  text not null,
  title       text not null,
  image_url   text not null,
  image_alt   text not null default '',
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists public.business_policies (
  id                            integer primary key default 1,
  replacement_sla_hours         integer not null default 2 check (replacement_sla_hours > 0),
  cancellation_full_hours       integer not null default 48 check (cancellation_full_hours >= 0),
  cancellation_partial_hours    integer not null default 24 check (cancellation_partial_hours >= 0),
  cancellation_partial_percent  integer not null default 50 check (cancellation_partial_percent between 0 and 100),
  standard_shift_hours          integer not null default 8 check (standard_shift_hours > 0),
  recommended_lead_hours        integer not null default 72 check (recommended_lead_hours >= 0),
  max_nannies                   integer not null default 3 check (max_nannies between 1 and 10),
  updated_at                    timestamptz not null default now(),
  constraint business_policies_singleton check (id = 1),
  constraint business_policies_windows check (cancellation_partial_hours <= cancellation_full_hours)
);

alter table public.bookings add column if not exists addon_codes text[] not null default '{}';

alter table public.pricing_tiers enable row level security;
alter table public.care_offerings enable row level security;
alter table public.pricing_addons enable row level security;
alter table public.faqs enable row level security;
alter table public.homepage_steps enable row level security;
alter table public.business_policies enable row level security;

drop policy if exists "pricing_tiers_public_read" on public.pricing_tiers;
create policy "pricing_tiers_public_read" on public.pricing_tiers
  for select using (is_active or public.is_admin());
drop policy if exists "pricing_tiers_admin_write" on public.pricing_tiers;
create policy "pricing_tiers_admin_write" on public.pricing_tiers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "care_offerings_public_read" on public.care_offerings;
create policy "care_offerings_public_read" on public.care_offerings
  for select using (is_active or public.is_admin());
drop policy if exists "care_offerings_admin_write" on public.care_offerings;
create policy "care_offerings_admin_write" on public.care_offerings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pricing_addons_public_read" on public.pricing_addons;
create policy "pricing_addons_public_read" on public.pricing_addons
  for select using (is_active or public.is_admin());
drop policy if exists "pricing_addons_admin_write" on public.pricing_addons;
create policy "pricing_addons_admin_write" on public.pricing_addons
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "faqs_public_read" on public.faqs;
create policy "faqs_public_read" on public.faqs
  for select using (is_active or public.is_admin());
drop policy if exists "faqs_admin_write" on public.faqs;
create policy "faqs_admin_write" on public.faqs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "homepage_steps_public_read" on public.homepage_steps;
create policy "homepage_steps_public_read" on public.homepage_steps
  for select using (is_active or public.is_admin());
drop policy if exists "homepage_steps_admin_write" on public.homepage_steps;
create policy "homepage_steps_admin_write" on public.homepage_steps
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "business_policies_public_read" on public.business_policies;
create policy "business_policies_public_read" on public.business_policies
  for select using (true);
drop policy if exists "business_policies_admin_write" on public.business_policies;
create policy "business_policies_admin_write" on public.business_policies
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.pricing_tiers (code, label, card_title, badge, description, period, daily_rate_kes, features, cta, sort_order)
values
  ('bronze', 'Standard', 'Bronze', 'ENTRY',
    'Reliable, caring nannies for straightforward childcare needs.',
    '{{standard_hours}}-hour shift · 1–2 children', 2200,
    array['Background-checked nanny', 'Basic first-aid trained', 'Ages 3–14 care', 'Single-property coverage', 'WhatsApp parent updates', '{{replacement_hours}}-hour replacement guarantee'],
    'Get Started', 1),
  ('silver', 'Pro', 'Silver', 'POPULAR',
    'Enhanced care with certified skills for growing families.',
    '{{standard_hours}}-hour shift · Up to 3 children', 3200,
    array['Everything in Bronze', 'Paediatric First Aid cert.', 'Infant & toddler care', 'Basic tutoring / homework', 'Swimming supervision', 'Bilingual (English + Swahili)'],
    'Choose Silver', 2),
  ('gold', 'Elite', 'Gold', 'ELITE',
    'Premium international-standard care for discerning families.',
    '{{standard_hours}}-hour shift · Up to 4 children', 5200,
    array['Everything in Silver', 'Newborn & special-needs care', 'Passport-holder · Can travel abroad', 'Montessori / early education', 'Multilingual (3+ languages)', 'Overnight care available'],
    'Go Elite →', 3)
on conflict (code) do nothing;

insert into public.care_offerings (code, label, hours, multiplier, hint, sort_order)
values
  ('standard', 'Standard (8 hours)', 8, 1, 'Daytime shift included in the daily rate.', 1),
  ('extended', 'Extended shift (12 hrs)', 12, 1.5, 'Four extra hours billed at 1.5× the daily rate.', 2),
  ('overnight', 'Overnight care', 16, 2, 'Overnight placement billed at 2× the daily rate.', 3)
on conflict (code) do nothing;

insert into public.pricing_addons (code, name, description, amount_kes, pricing_mode, sort_order)
values
  ('airport-escort', 'Airport transfer escort', '', 800, 'flat', 1),
  ('meal-preparation', 'Meal preparation', '', 500, 'flat', 2),
  ('light-tutoring', 'Light tutoring session', '', 600, 'flat', 3),
  ('activity-coordination', 'Activity coordination', '', 700, 'flat', 4),
  ('second-nanny', 'Second nanny (twin/triplet care)', '', 3000, 'flat', 5),
  ('international-travel', 'International travel', '', null, 'custom', 6)
on conflict (code) do nothing;

insert into public.faqs (question, answer, sort_order)
select question, answer, sort_order from (
  values
    (1, 'Are your nannies background-checked?',
      'Yes. Every nanny on VacayNanny undergoes a multi-layer vetting process including national ID verification, police clearance certificate (CoGC), reference checks, and an in-person or video interview. Gold-tier nannies also complete a safeguarding training module.'),
    (2, 'How far in advance should I book?',
      'We recommend booking at least {{lead_hours}} hours ahead for standard placements. For peak season (December–January, Easter, August) please book 1–2 weeks in advance to guarantee your preferred tier.'),
    (3, 'What happens if my nanny can''t make it on the day?',
      'We guarantee a replacement nanny within {{replacement_hours}} hours or your booking fee is fully refunded. Our coverage team monitors all active placements.'),
    (4, 'Do nannies travel with us to other countries?',
      'Yes. Gold-tier (Elite) nannies are passport-holders experienced in international travel. Travel arrangements (flights, accommodation) are at the client''s expense. See our terms for details.'),
    (5, 'What are the nanny working hours?',
      'Standard shifts are {{standard_hours}} hours. Extended shifts and overnight care are billed as a multiple of the daily rate, using the care packages on this page. Optional add-ons are charged at the published amount.'),
    (6, 'Can I request the same nanny for multiple days?',
      'Yes. When you book recurring days, we prioritise continuity so your children have a consistent carer. Specify this preference in the booking notes.'),
    (7, 'Are nannies trained in first aid?',
      'All Silver and Gold nannies hold a valid paediatric first-aid certificate. Bronze nannies have basic first-aid knowledge. You can filter by certification on the nanny search page.'),
    (8, 'What is the cancellation policy?',
      'Full refund if cancelled {{cancel_full_hours}} or more hours before the start time. {{cancel_partial_percent}}% refund from {{cancel_partial_hours}} hours up to that point. No refund for cancellations under {{cancel_partial_hours}} hours except in cases of verified emergency.'),
    (9, 'Can nannies handle infants?',
      'Yes. Indicate infant care as a required skill when booking and we will match you with a nanny who has newborn or infant experience. Infant care is available across tiers and is most experienced at Silver and above.'),
    (10, 'How are nannies paid?',
      'All payments go through VacayNanny. Families do not pay the nanny directly. This protects both parties and keeps the quality guarantee in force. Nannies are paid after each completed booking.'),
    (11, 'Is VacayNanny available outside Kenya?',
      'We currently operate in Kenya''s major tourism corridors (Diani, Malindi, Watamu, Nairobi, Mombasa, Lamu, and the national parks). We are expanding to Zanzibar, Rwanda, and South Africa. Join the waitlist to hear when a new country opens.')
) as seed(sort_order, question, answer)
where not exists (select 1 from public.faqs);

insert into public.homepage_steps (step_label, title, image_url, image_alt, sort_order)
select step_label, title, image_url, image_alt, sort_order from (
  values
    (1, 'Step 1', 'Search & Filter', '/images/step-1.png', 'Search on app'),
    (2, 'Step 2', 'Choose Your Nanny', '/images/step-2.png', 'Choose nanny'),
    (3, 'Step 3', 'Secure Booking', '/images/step-3.png', 'Book securely'),
    (4, 'Step 4', 'Enjoy Your Holiday', '/images/step-4.png', 'Enjoy holiday')
) as seed(sort_order, step_label, title, image_url, image_alt)
where not exists (select 1 from public.homepage_steps);

insert into public.business_policies (
  id, replacement_sla_hours, cancellation_full_hours, cancellation_partial_hours,
  cancellation_partial_percent, standard_shift_hours, recommended_lead_hours, max_nannies
) values (1, 2, 48, 24, 50, 8, 72, 3)
on conflict (id) do nothing;
