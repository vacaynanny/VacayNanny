-- Additive workflow safeguards. Apply after payments_and_agreements/security_hardening.
begin;

alter table public.nannies add column if not exists is_suspended boolean not null default false;
alter table public.nannies add column if not exists suspension_reason text;
-- Legacy hidden profiles require an operator review before self-service reactivation.
update public.nannies set is_suspended=true,suspension_reason=coalesce(suspension_reason,'Legacy hidden profile — operations review required') where not is_active;
alter table public.bookings add column if not exists version bigint not null default 0;
alter table public.bookings add column if not exists match_expires_at timestamptz;
alter table public.nanny_applications add column if not exists submission_key uuid unique;
alter table public.nanny_applications add column if not exists decision_version integer not null default 0;
alter table public.nanny_applications add column if not exists vetting_checks jsonb not null default '{}';
alter table public.nanny_applications add column if not exists vetting_reviewed_by uuid references public.profiles(id);
alter table public.nanny_applications add column if not exists vetting_reviewed_at timestamptz;

create table if not exists public.booking_assignments (
  booking_id uuid not null references public.bookings(id) on delete cascade,
  slot integer not null check(slot between 1 and 10),
  nanny_id uuid not null references public.nannies(id),
  response text not null default 'pending' check(response in ('pending','accepted')),
  responded_at timestamptz,
  primary key(booking_id,slot), unique(booking_id,nanny_id)
);
create index if not exists booking_assignments_nanny_idx on public.booking_assignments(nanny_id);
insert into public.booking_assignments(booking_id,slot,nanny_id,response,responded_at)
select id,1,nanny_id,case when nanny_response='accepted' then 'accepted' else 'pending' end,nanny_responded_at
from public.bookings where nanny_id is not null on conflict do nothing;

create table if not exists public.booking_care_slots (
  nanny_id uuid not null references public.nannies(id),
  care_date date not null,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  primary key(nanny_id,care_date)
);
create index if not exists booking_care_slots_booking_idx on public.booking_care_slots(booking_id);
create table if not exists public.workflow_jobs (
  id uuid primary key default gen_random_uuid(), kind text not null,
  payload jsonb not null, dedupe_key text not null unique,
  status text not null default 'pending' check(status in ('pending','processing','completed','failed')),
  attempts integer not null default 0, available_at timestamptz not null default now(),
  lease_token uuid, locked_at timestamptz, last_error text,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists workflow_jobs_due_idx on public.workflow_jobs(status,available_at);
create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
  kind text not null, summary text not null, booking_id uuid references public.bookings(id),
  status text not null default 'open' check(status in ('open','acknowledged','resolved')),
  assigned_to uuid references public.profiles(id), created_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists public.workflow_audit (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
  entity_type text not null, entity_id uuid not null, action text not null,
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table public.booking_assignments enable row level security;
alter table public.booking_care_slots enable row level security;
alter table public.workflow_jobs enable row level security;
alter table public.ops_tasks enable row level security;
alter table public.workflow_audit enable row level security;
revoke all on public.booking_assignments,public.booking_care_slots,public.workflow_jobs,public.ops_tasks,public.workflow_audit from anon,authenticated;
grant all on public.booking_assignments,public.booking_care_slots,public.workflow_jobs,public.ops_tasks,public.workflow_audit to service_role;
grant usage,select on sequence public.workflow_audit_id_seq to service_role;
grant select on public.booking_assignments to authenticated;
create policy assignments_involved_read on public.booking_assignments for select to authenticated using(
 public.is_admin() or nanny_id in(select id from public.nannies where user_id=auth.uid())
 or booking_id in(select id from public.bookings where parent_id=auth.uid()));

-- Email identity is owned by Auth; profile editing cannot change authorization fields.
create or replace function public.guard_profile_role() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('service_role','postgres','supabase_admin') and
 (new.role is distinct from old.role or new.email is distinct from old.email or new.id is distinct from old.id) then
 raise exception 'Identity and role changes must use the authorized account workflow.'; end if;
 return new;
end $$;
create or replace function public.guard_nanny_moderation() returns trigger language plpgsql set search_path='' as $$
begin
 if new.is_suspended then new.is_active=false; end if;
 return new;
end $$;
create trigger guard_nanny_moderation before insert or update on public.nannies for each row execute function public.guard_nanny_moderation();

create or replace function public.enqueue_workflow_job(p_kind text,p_payload jsonb,p_key text) returns uuid
language plpgsql set search_path=public as $$
declare result uuid;
begin
 insert into public.workflow_jobs(kind,payload,dedupe_key,available_at) values(p_kind,p_payload,p_key,case when p_kind='application_upload_cleanup' then now()+interval '3 hours' else now() end)
 on conflict(dedupe_key) do update set dedupe_key=excluded.dedupe_key returning id into result;
 return result;
end $$;

create or replace function public.rebuild_booking_slots(p_id uuid) returns void language plpgsql set search_path=public as $$
declare b public.bookings;
begin
 select * into b from public.bookings where id=p_id;
 delete from public.booking_care_slots where booking_id=p_id;
 if b.status not in ('matched','confirmed','in_progress') then return; end if;
 -- The unique key arbitrates competing transactions, including uncommitted inserts.
 insert into public.booking_care_slots(nanny_id,care_date,booking_id)
 select a.nanny_id,d::date,b.id from public.booking_assignments a
 cross join generate_series(b.check_in::timestamp,greatest(b.check_out-1,b.check_in)::timestamp,interval '1 day') d
 where a.booking_id=b.id order by a.nanny_id,d;
exception when unique_violation then
 raise exception using errcode='23P01',message='A selected nanny is unavailable on these dates.';
end $$;
-- Preserve legacy rows. Conflicts become explicit operations tasks, never deleted bookings.
insert into public.booking_care_slots(nanny_id,care_date,booking_id)
select a.nanny_id,d::date,b.id from public.bookings b join public.booking_assignments a on a.booking_id=b.id
cross join generate_series(b.check_in::timestamp,greatest(b.check_out-1,b.check_in)::timestamp,interval '1 day') d
where b.status in ('matched','confirmed','in_progress') order by b.created_at,b.id on conflict do nothing;
insert into public.ops_tasks(dedupe_key,kind,summary,booking_id)
select distinct 'legacy-clash:'||b.id,'scheduling_conflict','Review overlapping legacy nanny assignments.',b.id
from public.bookings b join public.booking_assignments a on a.booking_id=b.id
join public.booking_care_slots s on s.nanny_id=a.nanny_id and s.booking_id<>b.id
and s.care_date>=b.check_in and s.care_date<greatest(b.check_out,b.check_in+1)
where b.status in ('matched','confirmed','in_progress') on conflict do nothing;

update public.bookings set match_expires_at=now()+interval '24 hours' where status='matched' and match_expires_at is null;

create or replace function public.guard_booking_workflow() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' or new.check_in is distinct from old.check_in or new.check_out is distinct from old.check_out then
  if new.check_out<new.check_in or new.check_out-new.check_in>366 then raise exception 'Choose a valid care date range of up to one year.'; end if;
 end if;
 if tg_op='UPDATE' and new.status='in_progress' and old.status<>'in_progress' and exists(select 1 from public.booking_assignments x join public.nannies carer on carer.id=x.nanny_id where x.booking_id=new.id and carer.is_suspended) then raise exception 'An assigned carer is suspended. Arrange a replacement before starting care.'; end if;
 if tg_op='UPDATE' and new.status='in_progress' and old.status<>'in_progress' and (new.parent_confirmed_at is null or new.nanny_response is distinct from 'accepted' or (select count(*) from public.booking_assignments where booking_id=new.id and response='accepted')<>new.nannies_needed::integer) then raise exception 'The family and every assigned nanny must accept before care starts.'; end if;
 if (tg_op='INSERT' or new.nannies_needed is distinct from old.nannies_needed) and new.nannies_needed !~ '^[1-3]$' then raise exception 'Choose one, two or three nannies.'; end if;
 if tg_op='UPDATE' then new.version=old.version+1; end if;
 if new.status='matched' and (tg_op='INSERT' or old.status<>'matched' or new.nanny_id is distinct from old.nanny_id or new.check_in is distinct from old.check_in or new.check_out is distinct from old.check_out) then
 new.match_expires_at=least(now()+interval '24 hours',greatest(now()+interval '1 hour',new.check_in::timestamp at time zone 'Africa/Nairobi'));
 elsif new.status<>'matched' then new.match_expires_at=null; end if;
 return new;
end $$;
create trigger guard_booking_workflow before insert or update on public.bookings for each row execute function public.guard_booking_workflow();
create or replace function public.sync_booking_slots() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' then
  if new.nanny_id is not null then insert into public.booking_assignments(booking_id,slot,nanny_id,response,responded_at) values(new.id,1,new.nanny_id,case when new.nanny_response='accepted' then 'accepted' else 'pending' end,new.nanny_responded_at) on conflict do nothing; end if;
 elsif new.nanny_id is distinct from old.nanny_id then
  delete from public.booking_assignments where booking_id=new.id and slot=1;
  if new.nanny_id is not null then insert into public.booking_assignments(booking_id,slot,nanny_id) values(new.id,1,new.nanny_id); end if;
 end if;
 perform public.rebuild_booking_slots(new.id);
 if tg_op='UPDATE' and new.status is distinct from old.status and new.status in ('in_progress','completed') then
 perform public.enqueue_workflow_job('booking_event',jsonb_build_object('event',new.status,'booking',to_jsonb(new)||jsonb_build_object('booking_assignments',coalesce((select jsonb_agg(jsonb_build_object('nanny_id',x.nanny_id,'slot',x.slot,'response',x.response)) from public.booking_assignments x where x.booking_id=new.id),'[]'::jsonb))),'booking:'||new.id||':'||new.version); end if;
 return new;
end $$;
create trigger sync_booking_slots after insert or update on public.bookings for each row execute function public.sync_booking_slots();

create or replace function public.check_booking_nanny(p_nanny uuid,p_in date,p_out date,p_children text,p_needed text,p_age text) returns void language plpgsql set search_path=public as $$
declare n public.nannies; cap integer;
begin
 select * into n from public.nannies where id=p_nanny for share;
 if not found or not n.is_active or n.is_suspended then raise exception 'Choose an available approved nanny.'; end if;
 if exists(select 1 from generate_series(p_in::timestamp,greatest(p_out-1,p_in)::timestamp,interval '1 day') d where not(trim(to_char(d,'Day'))=any(n.available_days))) then raise exception 'The nanny is not available every requested day.'; end if;
 cap=case when n.tier='gold' and n.safeguarding_completed_at is not null then 4 when n.tier in ('silver','gold') then 3 else 2 end;
 if p_children !~ '^([1-9]|1[0-2])$' or ceil(p_children::numeric/p_needed::integer)>cap then raise exception 'Choose enough qualified nannies for the number of children.'; end if;
 if p_age ~* '(under[[:space:]]*1|0[[:space:]]*[–-][[:space:]]*12|newborn|infant)' and not(array_to_string(n.age_groups||n.services||n.certifications||n.tags,' ') ~* '(infant|newborn|baby|0[[:space:]]*[–-][[:space:]]*12)') then raise exception 'This placement requires verified infant care experience.'; end if;
end $$;

create or replace function public.nanny_moderation_followup() returns trigger language plpgsql set search_path=public as $$
declare a public.nanny_applications;
begin
 if new.is_suspended and (tg_op='INSERT' or not old.is_suspended) then
  insert into public.ops_tasks(dedupe_key,kind,summary,booking_id)
  select 'suspension:'||new.id||':'||b.id||':'||now(),'nanny_suspended','An assigned nanny is suspended. Contact the family and arrange a replacement.',b.id from public.bookings b join public.booking_assignments x on x.booking_id=b.id
  where x.nanny_id=new.id and b.status in ('matched','confirmed','in_progress') on conflict do nothing;
  perform public.enqueue_workflow_job('ops_notice',jsonb_build_object('summary','A nanny suspension requires review of active placements.'),'suspension-notice:'||new.id||':'||now());
 end if;
 if new.is_active and (tg_op='INSERT' or not old.is_active) then
  select * into a from public.nanny_applications where id=new.application_id;
  if a.email is not null then perform public.enqueue_workflow_job('profile_activated',jsonb_build_object('fullName',a.full_name,'email',a.email,'slug',new.slug),'activation:'||new.id); end if;
 end if;
 return new;
end $$;
create trigger nanny_moderation_followup after insert or update on public.nannies for each row execute function public.nanny_moderation_followup();

-- All callers are server-only. Actor identity and verified email come from getUser().
create or replace function public.commit_booking_mutation(p_id uuid,p_version bigint,p_action text,p_updates jsonb,
 p_actor uuid,p_verified_email text,p_guest_hash text,p_slot integer default 1,p_nanny uuid default null,p_event text default 'matched',p_note text default null)
returns jsonb language plpgsql set search_path=public as $$
declare b public.bookings; n public.bookings; admin boolean; parent boolean; actor_nanny uuid; filled integer; accepted integer; event text=p_event; old_nanny uuid;
begin
 select * into b from public.bookings where id=p_id for update;
 if not found then raise exception using errcode='P0002',message='Booking not found.'; end if;
 if b.version<>p_version then raise exception using errcode='40001',message='Booking changed. Retry with the current record.'; end if;
 admin=exists(select 1 from public.profiles where id=p_actor and role='admin');
 parent=(b.parent_id=p_actor) or (b.parent_id is null and p_verified_email is not null and lower(b.email)=lower(p_verified_email)) or (p_guest_hash is not null and p_guest_hash=b.guest_access_token_hash);
 select a.nanny_id into actor_nanny from public.booking_assignments a join public.nannies x on x.id=a.nanny_id where a.booking_id=b.id and x.user_id=p_actor and not x.is_suspended;
 if p_action in ('confirm','cancel','reschedule') then
  if not coalesce(parent or admin,false) then raise insufficient_privilege using message='Forbidden'; end if;
 elsif p_action in ('accept','decline') then
  if actor_nanny is null and not admin then raise insufficient_privilege using message='Forbidden'; end if;
 else if not admin then raise insufficient_privilege using message='Forbidden'; end if; end if;
 if b.status in ('completed','cancelled') then raise exception 'This booking is closed.'; end if;
 if p_action in ('accept','confirm') and b.status not in ('matched','confirmed') then raise exception 'Accept the proposed match before care starts.'; end if;
 if p_action in ('accept','confirm') and b.match_expires_at is not null and b.match_expires_at<=now() then raise exception 'This proposal has expired. Ask our team for a new match.'; end if;
 if b.nannies_needed !~ '^[1-3]$' and p_action not in ('cancel','set_status') then raise exception 'This legacy booking needs an operations review before staffing changes.'; end if;
 if p_action='accept' and exists(select 1 from public.booking_assignments where booking_id=b.id and response='accepted' and (nanny_id=actor_nanny or (admin and slot=p_slot))) then return jsonb_build_object('event','nanny_accepted','version',b.version); end if;
 if p_action='confirm' and b.parent_confirmed_at is not null then return jsonb_build_object('event','parent_confirmed','version',b.version); end if;
 if p_action='reschedule' and (p_updates->>'check_in')::date=b.check_in and (p_updates->>'check_out')::date=b.check_out then return jsonb_build_object('event','rescheduled','version',b.version); end if;
 if p_action='assign' and ((p_nanny is null and not exists(select 1 from public.booking_assignments where booking_id=b.id and slot=p_slot)) or exists(select 1 from public.booking_assignments where booking_id=b.id and slot=p_slot and nanny_id=p_nanny)) then return jsonb_build_object('event','matched','version',b.version); end if;
 n=jsonb_populate_record(b,p_updates);
 -- Identity, dates, amount and state are only changed through this validated server RPC.
 n.id=b.id; n.parent_id=b.parent_id; n.email=b.email; n.guest_access_token_hash=b.guest_access_token_hash;
 if p_action='assign' then
  if p_slot>1 and not exists(select 1 from public.booking_assignments where booking_id=b.id and slot=1) then raise exception 'Assign the lead nanny first.'; end if;
  if p_slot<1 or p_slot>b.nannies_needed::integer then raise exception 'Invalid nanny assignment slot.'; end if;
  if p_nanny is null then delete from public.booking_assignments where booking_id=b.id and slot=p_slot;
  else
   if not exists(select 1 from public.nannies where id=p_nanny and is_active and not is_suspended) then raise exception 'Choose an available approved nanny.'; end if;
   perform public.check_booking_nanny(p_nanny,b.check_in,b.check_out,b.children_count,b.nannies_needed,b.youngest_age);
   insert into public.booking_assignments(booking_id,slot,nanny_id) values(b.id,p_slot,p_nanny)
   on conflict(booking_id,slot) do update set nanny_id=excluded.nanny_id,response='pending',responded_at=null;
  end if;
  n.parent_confirmed_at=null; n.status='matched'; n.nanny_response='pending';
  select nanny_id into n.nanny_id from public.booking_assignments where booking_id=b.id and slot=1;
 elsif p_action='accept' then
  if admin then select nanny_id into actor_nanny from public.booking_assignments where booking_id=b.id and slot=p_slot; end if;
  update public.booking_assignments set response='accepted',responded_at=now() where booking_id=b.id and nanny_id=actor_nanny;
  if not found then raise exception 'No nanny is assigned to this slot.'; end if;
  n.status=b.status; n.parent_confirmed_at=b.parent_confirmed_at;
 elsif p_action='confirm' then
  if (select count(*) from public.booking_assignments where booking_id=b.id)<>b.nannies_needed::integer then raise exception 'Wait until your complete care team is proposed before confirming.'; end if;
  n.parent_confirmed_at=now(); n.status=b.status;
 elsif p_action='reschedule' then
  perform public.check_booking_nanny(x.nanny_id,n.check_in,n.check_out,n.children_count,n.nannies_needed,n.youngest_age) from public.booking_assignments x where x.booking_id=b.id order by x.nanny_id;
  n.parent_confirmed_at=null; n.nanny_responded_at=null; n.nanny_response='pending';
  update public.booking_assignments set response='pending',responded_at=null where booking_id=b.id;
  n.status=case when exists(select 1 from public.booking_assignments where booking_id=b.id) then 'matched'::public.booking_status else 'pending'::public.booking_status end;
 elsif p_action in ('decline','replace') then
  if p_action='replace' or admin then select nanny_id into actor_nanny from public.booking_assignments where booking_id=b.id and slot=p_slot; end if;
  old_nanny=actor_nanny;
  delete from public.booking_assignments where booking_id=b.id and nanny_id=actor_nanny;
  n.parent_confirmed_at=null; n.nanny_response=null; n.nanny_responded_at=null;
  select nanny_id into n.nanny_id from public.booking_assignments where booking_id=b.id and slot=1;
  n.status='matched'; n.replaced_nanny_id=old_nanny;
  if b.status in ('confirmed','in_progress') or b.parent_confirmed_at is not null or p_action='replace' then
   n.replacement_requested_at=now(); n.replacement_fulfilled_at=null; event='replacement_started';
  else event='nanny_declined'; end if;
 elsif p_action='set_status' then
  if n.status='in_progress' and b.status<>'confirmed' then raise exception 'Only a confirmed booking can start.'; end if;
  if n.status='completed' and b.status<>'in_progress' then raise exception 'Only care in progress can be completed.'; end if;
  if n.status='matched' and b.status not in ('pending','matched') then raise exception 'Use replacement to change an accepted match.'; end if;
  if n.status='pending' then delete from public.booking_assignments where booking_id=b.id; n.nanny_id=null; n.parent_confirmed_at=null; n.nanny_response=null; end if;
 end if;
 select count(*),count(*) filter(where response='accepted') into filled,accepted from public.booking_assignments where booking_id=b.id;
 if p_action in ('confirm','accept','assign','reschedule') then
  n.nanny_response=case when filled=b.nannies_needed::integer and accepted=filled then 'accepted' else 'pending' end;
  if n.parent_confirmed_at is not null and n.nanny_response='accepted' then n.status='confirmed'; event='confirmed'; end if;
 end if;
 if n.replacement_requested_at is not null and p_action in ('confirm','accept','assign','reschedule') then
  n.replacement_fulfilled_at=case when n.status='confirmed' then now() else null end;
 end if;
 if n.status in ('confirmed','in_progress') and exists(select 1 from public.booking_assignments x join public.nannies carer on carer.id=x.nanny_id where x.booking_id=b.id and carer.is_suspended) then raise exception 'An assigned carer is under review. Operations must arrange a replacement.'; end if;
 if n.status in ('confirmed','in_progress') and (filled<>b.nannies_needed::integer or accepted<>filled or n.parent_confirmed_at is null) then raise exception 'The family and every assigned nanny must accept first.'; end if;
 update public.bookings set nanny_id=n.nanny_id,status=n.status,parent_confirmed_at=n.parent_confirmed_at,nanny_response=n.nanny_response,nanny_responded_at=n.nanny_responded_at,
 check_in=n.check_in,check_out=n.check_out,tier=n.tier,total_amount_kes=n.total_amount_kes,cancelled_at=n.cancelled_at,cancellation_reason=n.cancellation_reason,refund_percent=n.refund_percent,
 replacement_requested_at=n.replacement_requested_at,replacement_fulfilled_at=n.replacement_fulfilled_at,replaced_nanny_id=n.replaced_nanny_id,
 match_expires_at=case when n.status='matched' then case when p_action in ('assign','reschedule','replace','decline') then least(now()+interval '24 hours',greatest(now()+interval '1 hour',n.check_in::timestamp at time zone 'Africa/Nairobi')) else b.match_expires_at end else null end
 where id=b.id returning * into n;
 perform public.enqueue_workflow_job('booking_event',jsonb_build_object('event',event,'booking',to_jsonb(n)||jsonb_build_object('booking_assignments',coalesce((select jsonb_agg(jsonb_build_object('nanny_id',x.nanny_id,'slot',x.slot,'response',x.response)) from public.booking_assignments x where x.booking_id=n.id),'[]'::jsonb)),'extraNannyId',old_nanny,'note',p_note),'booking:'||b.id||':'||n.version);
 insert into public.workflow_audit(actor_id,entity_type,entity_id,action,details) values(p_actor,'booking',b.id,p_action,jsonb_build_object('previousStatus',b.status,'status',n.status,'slot',p_slot));
 return jsonb_build_object('event',event,'version',n.version);
end $$;

create or replace function public.claim_workflow_jobs(p_limit integer default 30,p_kinds text[] default null) returns setof public.workflow_jobs language plpgsql set search_path=public as $$
begin
 return query update public.workflow_jobs j set status='processing',attempts=j.attempts+1,locked_at=now(),lease_token=gen_random_uuid()
 where j.id in(select id from public.workflow_jobs where ((status='pending' and available_at<=now()) or (status='processing' and locked_at<now()-interval '15 minutes')) and (p_kinds is null or kind=any(p_kinds)) order by available_at for update skip locked limit least(p_limit,100)) returning j.*;
end $$;
create or replace function public.finish_workflow_job(p_id uuid,p_lease uuid,p_error text default null) returns void language plpgsql set search_path=public as $$
declare j public.workflow_jobs;
begin
 select * into j from public.workflow_jobs where id=p_id and lease_token=p_lease and status='processing' for update;
 if not found then return; end if;
 update public.workflow_jobs set status=case when p_error is null then 'completed' when attempts>=8 then 'failed' else 'pending' end,
 completed_at=case when p_error is null then now() else null end,last_error=left(p_error,500),lease_token=null,locked_at=null,
 available_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)) where id=p_id;
 if p_error is not null and j.attempts>=8 then
 insert into public.ops_tasks(dedupe_key,kind,summary) values('notification:'||j.id,'notification_failed','A notification needs review and retry.') on conflict do nothing; end if;
end $$;

create or replace function public.run_workflow_automation() returns integer language plpgsql set search_path=public as $$
declare b public.bookings; changed integer=0;
begin
 for b in select * from public.bookings where status='matched' and match_expires_at<=now() for update skip locked loop
  delete from public.booking_assignments where booking_id=b.id;
  update public.bookings set nanny_id=null,nanny_response=null,parent_confirmed_at=null,status='pending',match_expires_at=null where id=b.id;
  insert into public.ops_tasks(dedupe_key,kind,summary,booking_id) values('proposal-expired:'||b.id||':'||b.version,'match_expired','Match expired; contact the family and propose an available nanny.',b.id) on conflict do nothing;
  perform public.enqueue_workflow_job('ops_notice',jsonb_build_object('summary','A nanny proposal expired. Review the booking in operations.','bookingId',b.id),'expired:'||b.id||':'||b.version);
  changed=changed+1;
 end loop;
 with created_tasks as (insert into public.ops_tasks(dedupe_key,kind,summary,booking_id)
 select 'replacement-overdue:'||pending_booking.id||':'||pending_booking.replacement_requested_at,'replacement_overdue','The replacement deadline has passed. Urgent family follow-up is required.',pending_booking.id from public.bookings pending_booking
 where pending_booking.status not in ('cancelled','completed') and pending_booking.replacement_requested_at is not null and pending_booking.replacement_fulfilled_at is null
 and pending_booking.replacement_requested_at+make_interval(hours=>coalesce((select replacement_sla_hours from public.business_policies limit 1),2))<=now()
 on conflict do nothing returning id,summary,booking_id)
 select count(public.enqueue_workflow_job('ops_notice',jsonb_build_object('summary',summary,'bookingId',booking_id),'escalation:'||id)) into changed from created_tasks;
 update public.ops_tasks t set status='resolved',resolved_at=now() from public.bookings resolved_booking where t.booking_id=resolved_booking.id and t.kind='replacement_overdue' and t.status<>'resolved' and (resolved_booking.replacement_fulfilled_at is not null or resolved_booking.status in ('completed','cancelled'));
 delete from public.workflow_jobs where status='completed' and completed_at<now()-interval '30 days';
 return changed;
end $$;

create or replace function public.save_booking_request(p_row jsonb,p_notification jsonb) returns uuid language plpgsql set search_path=public as $$
declare b public.bookings;
begin
 if p_row->>'nanny_id' is not null then perform public.check_booking_nanny((p_row->>'nanny_id')::uuid,(p_row->>'check_in')::date,(p_row->>'check_out')::date,p_row->>'children_count',p_row->>'nannies_needed',p_row->>'youngest_age'); end if;
 insert into public.bookings(id,parent_id,nanny_id,parent_name,email,phone,destination,check_in,check_out,children_count,youngest_age,nannies_needed,tier,notes,status,nanny_response,care_type,total_amount_kes,addon_codes,guest_access_token_hash,payment_status)
 select r.id,r.parent_id,r.nanny_id,r.parent_name,r.email,r.phone,r.destination,r.check_in,r.check_out,r.children_count,r.youngest_age,r.nannies_needed,r.tier,r.notes,r.status,r.nanny_response,r.care_type,r.total_amount_kes,r.addon_codes,r.guest_access_token_hash,r.payment_status from jsonb_populate_record(null::public.bookings,p_row) r returning * into b;
 perform public.enqueue_workflow_job('booking_received',jsonb_build_object('booking',to_jsonb(b)||jsonb_build_object('booking_assignments',coalesce((select jsonb_agg(jsonb_build_object('nanny_id',x.nanny_id,'slot',x.slot,'response',x.response)) from public.booking_assignments x where x.booking_id=b.id),'[]'::jsonb)),'notification',p_notification),'booking-received:'||b.id);
 if b.nanny_id is not null then perform public.enqueue_workflow_job('booking_event',jsonb_build_object('event','matched','booking',to_jsonb(b)||jsonb_build_object('booking_assignments',coalesce((select jsonb_agg(jsonb_build_object('nanny_id',x.nanny_id,'slot',x.slot,'response',x.response)) from public.booking_assignments x where x.booking_id=b.id),'[]'::jsonb))),'booking:'||b.id||':0'); end if;
 return b.id;
end $$;

create or replace function public.save_complete_application(p_row jsonb,p_references jsonb,p_documents jsonb) returns jsonb language plpgsql set search_path=public as $$
declare a public.nanny_applications; item jsonb; existing public.nanny_applications;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_row->>'submission_key',0));
 select * into existing from public.nanny_applications where submission_key=(p_row->>'submission_key')::uuid;
 if found then
  if lower(existing.email)<>lower(p_row->>'email') then raise exception 'Submission key already used.'; end if;
  return jsonb_build_object('id',existing.id);
 end if;
 if not coalesce((p_row->>'consent_background')::boolean,false) or not coalesce((p_row->>'consent_terms')::boolean,false) or not coalesce((p_row->>'consent_accuracy')::boolean,false) then raise exception 'All application consents are required.'; end if;
 if (p_row->>'date_of_birth')::date > current_date-interval '21 years' then raise exception 'Applicants must be 21 years or older.'; end if;
 if jsonb_array_length(p_references)<>2 then raise exception 'Two references are required.'; end if;
 if exists(select kind from unnest(array['photo','id_front','id_back','selfie']) kind where not exists(select 1 from jsonb_array_elements(p_documents) d where d->>'kind'=kind)) then raise exception 'Required identity documents are missing.'; end if;
 insert into public.nanny_applications select (jsonb_populate_record(null::public.nanny_applications,p_row||jsonb_build_object('created_at',now(),'updated_at',now(),'status','pending','decision_version',0,'vetting_checks','{}'::jsonb))).* returning * into a;
 for item in select value from jsonb_array_elements(p_references) loop
  insert into public.nanny_references select (jsonb_populate_record(null::public.nanny_references,item||jsonb_build_object('id',gen_random_uuid(),'application_id',a.id,'created_at',now()))).*;
 end loop;
 for item in select value from jsonb_array_elements(p_documents) loop
  insert into public.nanny_documents select (jsonb_populate_record(null::public.nanny_documents,item||jsonb_build_object('id',gen_random_uuid(),'application_id',a.id,'created_at',now()))).*;
 end loop;
 perform public.enqueue_workflow_job('application_received',jsonb_build_object('applicationId',a.id),'application-received:'||a.id);
 return jsonb_build_object('id',a.id);
end $$;

create or replace function public.claim_nanny_applications(p_actor uuid,p_verified_email text) returns integer language plpgsql set search_path=public as $$
declare a public.nanny_applications; linked integer=0;
begin
 if p_verified_email is null then raise exception 'Verify your email before linking an application.'; end if;
 -- The function is server-only; Auth.getUser supplies both arguments.
 perform pg_advisory_xact_lock(hashtextextended(lower(p_verified_email),1));
 for a in select * from public.nanny_applications where lower(email)=lower(p_verified_email) and (user_id is null or user_id=p_actor) order by created_at desc for update loop
  if exists(select 1 from public.nannies where application_id=a.id and user_id is not null and user_id<>p_actor) then continue; end if;
  if exists(select 1 from public.nannies where user_id=p_actor and application_id<>a.id) then continue; end if;
  update public.nanny_applications set user_id=p_actor where id=a.id;
  update public.nannies set user_id=p_actor where application_id=a.id and user_id is null;
  linked=linked+1;
 end loop;
 if linked>0 then update public.profiles set role='nanny' where id=p_actor and role<>'admin'; end if;
 return linked;
end $$;

create or replace function public.review_nanny_application(p_id uuid,p_actor uuid,p_changes jsonb,p_notify_interview boolean default false) returns void language plpgsql set search_path=public as $$
declare a public.nanny_applications; old_status public.application_status; check_name text;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise insufficient_privilege; end if;
 select * into a from public.nanny_applications where id=p_id for update;
 if not found then raise exception 'Application not found.'; end if;
 old_status=a.status;
 a=jsonb_populate_record(a,p_changes);
 if a.status='approved' then
  foreach check_name in array array['identity','policeClearance','references','interview','qualifications'] loop
   if a.vetting_checks->>check_name is distinct from 'true' then raise exception 'Complete every verification check before approving.'; end if;
  end loop;
  if (select count(*) from public.nanny_references where application_id=a.id)<2 then raise exception 'Two references are required before approval.'; end if;
  if exists(select kind from unnest(array['photo','id_front','id_back','selfie','cogc']) kind where not exists(select 1 from public.nanny_documents d where d.application_id=a.id and d.kind::text=kind)) then raise exception 'Verify the complete identity and police clearance documents first.'; end if;
  a.vetting_reviewed_at=now();a.vetting_reviewed_by=p_actor;
 end if;
 if a.status<>old_status then a.decision_version=a.decision_version+1; end if;
 if a.status='approved' and old_status<>'approved' then a.approval_email_sent_at=null; end if;
 update public.nanny_applications set decision_version=a.decision_version,approval_email_sent_at=a.approval_email_sent_at,status=a.status,admin_notes=a.admin_notes,interview_at=a.interview_at,estimated_tier=a.estimated_tier,vetting_checks=a.vetting_checks,vetting_reviewed_at=a.vetting_reviewed_at,vetting_reviewed_by=a.vetting_reviewed_by where id=p_id;
 if a.status='approved' and a.user_id is not null then update public.profiles set role='nanny' where id=a.user_id and role<>'admin'; end if;
 if old_status='approved' and a.status<>'approved' then update public.nannies set is_active=false,is_suspended=true,suspension_reason='Application approval withdrawn' where application_id=p_id; end if;
 if a.status in ('approved','rejected') and (a.status<>old_status or (a.status='approved' and a.approval_email_sent_at is null)) then
  perform public.enqueue_workflow_job('application_status',jsonb_build_object('applicationId',p_id,'status',a.status),'application-status:'||p_id||':'||a.status||':'||a.decision_version);
 end if;
 if p_notify_interview and a.interview_at is not null then perform public.enqueue_workflow_job('application_interview',jsonb_build_object('applicationId',p_id,'interviewAt',a.interview_at),'interview:'||p_id||':'||a.interview_at); end if;
 insert into public.workflow_audit(actor_id,entity_type,entity_id,action,details) values(p_actor,'application',p_id,'review',jsonb_build_object('previousStatus',old_status,'status',a.status,'checks',a.vetting_checks));
end $$;

alter table public.contact_messages add column if not exists care_service text;
alter table public.contact_messages add column if not exists care_status text not null default 'new' check(care_status in ('new','assessing','quoted','accepted','fulfilled','closed'));
alter table public.contact_messages add column if not exists family_id uuid references public.profiles(id);
alter table public.contact_messages add column if not exists assigned_to uuid references public.profiles(id);
alter table public.contact_messages add column if not exists assessment_notes text;
alter table public.contact_messages add column if not exists provider_details text;
alter table public.contact_messages add column if not exists quote_summary text;
alter table public.contact_messages add column if not exists quote_amount_kes integer;
alter table public.contact_messages add column if not exists quote_expires_at timestamptz;
alter table public.contact_messages add column if not exists quoted_at timestamptz;
alter table public.contact_messages add column if not exists accepted_at timestamptz;
alter table public.contact_messages add column if not exists service_start date;
alter table public.contact_messages add column if not exists service_end date;
alter table public.contact_messages add column if not exists quote_version integer not null default 0;
alter table public.contact_messages add column if not exists guest_access_token_hash text;
create index if not exists contact_messages_family_idx on public.contact_messages(family_id);
create index if not exists contact_messages_status_idx on public.contact_messages(care_status) where care_service is not null;

create or replace function public.save_contact_enquiry(p_row jsonb,p_notice jsonb default null) returns uuid language plpgsql set search_path=public as $$
declare c public.contact_messages;
begin
 insert into public.contact_messages(id,name,email,subject,message,care_service,family_id,guest_access_token_hash)
 select r.id,r.name,r.email,r.subject,r.message,r.care_service,r.family_id,r.guest_access_token_hash from jsonb_populate_record(null::public.contact_messages,p_row) r returning * into c;
 perform public.enqueue_workflow_job('ops_notice',jsonb_build_object('summary',case when c.care_service is not null then 'A new specialist care enquiry needs assignment and assessment.' else 'A new contact enquiry is waiting in your inbox.' end),'contact-notice:'||c.id);
 if p_notice is not null then perform public.enqueue_workflow_job('email',jsonb_build_object('sealed',p_notice),'care-received:'||c.id); end if;
 return c.id;
end $$;

create or replace function public.update_care_enquiry(p_id uuid,p_actor uuid,p_version integer,p_changes jsonb,p_notice jsonb default null) returns void language plpgsql set search_path=public as $$
declare c public.contact_messages; old_status text;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise insufficient_privilege; end if;
 select * into c from public.contact_messages where id=p_id and care_service is not null for update;
 if not found then raise exception 'Specialist care enquiry not found.'; end if;
 if c.quote_version<>p_version then raise exception using errcode='40001',message='This enquiry changed. Refresh and retry.'; end if;
 old_status=c.care_status;
 if old_status in ('accepted','fulfilled','closed') and p_changes ?| array['quote_summary','quote_amount_kes','quote_expires_at','service_start','service_end','provider_details'] then raise exception 'Accepted quote terms cannot be changed.'; end if;
 c=jsonb_populate_record(c,p_changes);
 if c.assigned_to is not null and not exists(select 1 from public.profiles where id=c.assigned_to and role='admin') then raise exception 'Assign a current operations team member.'; end if;
 if old_status in ('accepted','fulfilled','closed') and c.care_status not in ('fulfilled','closed') then raise exception 'Accepted or closed quotes cannot be silently changed.'; end if;
 if c.care_status='quoted' then
  if c.assigned_to is null or length(coalesce(c.assessment_notes,''))<10 or length(coalesce(c.quote_summary,''))<20 or length(coalesce(c.provider_details,''))<10 then raise exception 'Assign an operator and record the assessment, qualified provider details and complete quote scope.'; end if;
  if c.quote_amount_kes is null or c.quote_amount_kes<=0 or c.quote_expires_at<=now() or c.quote_expires_at is null then raise exception 'Provide a positive quote and a future expiry.'; end if;
  if c.service_start is null or c.service_end is null or c.service_end<c.service_start or c.service_start<(now() at time zone 'Africa/Nairobi')::date then raise exception 'Choose valid service dates.'; end if;
  if p_notice is null then raise exception 'The quote notification must be queued with the quote.'; end if;
  c.quoted_at=now();c.accepted_at=null;
 elsif c.care_status='accepted' then raise exception 'The family must accept the quote.';
 elsif c.care_status='fulfilled' and old_status<>'accepted' then raise exception 'Only accepted care can be marked fulfilled.';
 elsif c.care_status='assessing' and c.assigned_to is null then raise exception 'Assign an operator before assessment.';
 end if;
 update public.contact_messages set care_status=c.care_status,assigned_to=c.assigned_to,assessment_notes=c.assessment_notes,provider_details=c.provider_details,quote_summary=c.quote_summary,quote_amount_kes=c.quote_amount_kes,quote_expires_at=c.quote_expires_at,quoted_at=c.quoted_at,accepted_at=c.accepted_at,service_start=c.service_start,service_end=c.service_end,quote_version=quote_version+1 where id=p_id;
 if c.care_status='quoted' then perform public.enqueue_workflow_job('email',jsonb_build_object('sealed',p_notice),'care-quote:'||p_id||':'||(p_version+1)); end if;
 insert into public.workflow_audit(actor_id,entity_type,entity_id,action,details) values(p_actor,'care_enquiry',p_id,'update',jsonb_build_object('previousStatus',old_status,'status',c.care_status));
end $$;

create or replace function public.accept_care_quote(p_id uuid,p_version integer,p_actor uuid,p_verified_email text,p_guest_hash text) returns void language plpgsql set search_path=public as $$
declare c public.contact_messages;
begin
 select * into c from public.contact_messages where id=p_id and care_service is not null for update;
 if not found then raise exception 'Enquiry not found.'; end if;
 if not coalesce(c.family_id=p_actor or (c.family_id is null and p_verified_email is not null and lower(c.email)=lower(p_verified_email)) or (p_guest_hash is not null and p_guest_hash=c.guest_access_token_hash),false) then raise insufficient_privilege; end if;
 if c.quote_version<>p_version or c.care_status<>'quoted' or c.quote_expires_at<=now() then raise exception 'This quote changed or expired. Ask our team for an updated quote.'; end if;
 update public.contact_messages set care_status='accepted',accepted_at=now(),quote_version=quote_version+1 where id=p_id;
 perform public.enqueue_workflow_job('ops_notice',jsonb_build_object('summary','A family accepted a specialist care quote. Confirm the service arrangements.'),'care-accepted:'||p_id||':'||p_version);
 insert into public.workflow_audit(actor_id,entity_type,entity_id,action) values(p_actor,'care_enquiry',p_id,'accept');
end $$;

create or replace function public.guard_nanny_publication() returns trigger language plpgsql set search_path=public as $$
begin
 if new.is_active and (tg_op='INSERT' or not old.is_active) then
  if not exists(select 1 from public.nanny_applications a where a.id=new.application_id and a.status='approved' and a.agreement_signed_path is not null and a.agreement_reviewed_at is not null and a.agreement_reviewed_by is not null) then raise exception 'Approve the application and review the signed agreement before publishing.'; end if;
  if not exists(select 1 from public.nanny_applications a where a.id=new.application_id and a.vetting_reviewed_at is not null and a.vetting_reviewed_by is not null and a.vetting_checks @> '{"identity":true,"policeClearance":true,"references":true,"interview":true,"qualifications":true}') then raise exception 'Complete and record all verification checks before publishing.'; end if;
 end if;
 return new;
end $$;
create or replace function public.moderate_nanny(p_id uuid,p_actor uuid,p_active boolean) returns jsonb language plpgsql set search_path=public as $$
declare n public.nannies;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise insufficient_privilege; end if;
 update public.nannies set is_active=p_active,is_suspended=not p_active,suspension_reason=case when p_active then null else 'Suspended by VacayNanny operations' end where id=p_id returning * into n;
 if not found then raise exception 'Nanny not found.'; end if;
 insert into public.workflow_audit(actor_id,entity_type,entity_id,action) values(p_actor,'nanny',p_id,case when p_active then 'restore' else 'suspend' end);
 return jsonb_build_object('id',n.id,'display_name',n.display_name,'is_active',n.is_active);
end $$;
create or replace function public.record_nanny_agreement(p_id uuid,p_actor uuid,p_path text) returns void language plpgsql set search_path=public as $$
declare a public.nanny_applications;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise insufficient_privilege; end if;
 select * into a from public.nanny_applications where id=p_id for update;
 if not found or a.status<>'approved' then raise exception 'Approve the application before recording its signed agreement.'; end if;
 update public.nanny_applications set agreement_signed_path=p_path,agreement_reviewed_at=now(),agreement_reviewed_by=p_actor where id=p_id;
 insert into public.workflow_audit(actor_id,entity_type,entity_id,action) values(p_actor,'application',p_id,'agreement_reviewed');
end $$;

create or replace function public.queue_booking_message() returns trigger language plpgsql set search_path=public as $$
begin
 perform public.enqueue_workflow_job('booking_message',jsonb_build_object('messageId',new.id,'bookingId',new.booking_id),'message:'||new.id);
 return new;
end $$;
create trigger queue_booking_message after insert on public.booking_messages for each row execute function public.queue_booking_message();

insert into public.ops_tasks(dedupe_key,kind,summary,booking_id)
select 'legacy-state:'||b.id,'booking_state_review','Review this legacy confirmation and obtain any missing family/nanny acceptance before care starts.',b.id from public.bookings b
where b.status='confirmed' and (b.nannies_needed !~ '^[1-3]$' or b.parent_confirmed_at is null or b.nanny_response is distinct from 'accepted' or (select count(*) from public.booking_assignments a where a.booking_id=b.id and a.response='accepted')<>case when b.nannies_needed ~ '^[1-3]$' then b.nannies_needed::integer else 1 end) on conflict do nothing;
insert into public.ops_tasks(dedupe_key,kind,summary,booking_id)
select distinct 'migration-suspended-carer:'||b.id,'nanny_suspended','An assigned legacy profile is hidden or suspended. Review care arrangements before starting.',b.id from public.bookings b join public.booking_assignments a on a.booking_id=b.id join public.nannies n on n.id=a.nanny_id where n.is_suspended and b.status in ('matched','confirmed','in_progress') on conflict do nothing;
-- Server-only operations; no callable public bypasses.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in(
 'queue_booking_message','guard_nanny_publication','moderate_nanny','record_nanny_agreement','save_contact_enquiry','update_care_enquiry','accept_care_quote','nanny_moderation_followup','check_booking_nanny','review_nanny_application','claim_nanny_applications','save_complete_application','save_booking_request','guard_profile_role','guard_nanny_moderation','enqueue_workflow_job','rebuild_booking_slots','guard_booking_workflow','sync_booking_slots','commit_booking_mutation','claim_workflow_jobs','finish_workflow_job','run_workflow_automation') loop
 execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop; end $$;
commit;
