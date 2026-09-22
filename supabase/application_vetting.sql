-- Run this in the Supabase SQL editor on an existing VacayNanny project.
-- New installs get the same column from schema.sql.

alter table public.nanny_applications
  add column if not exists interview_at timestamptz;
