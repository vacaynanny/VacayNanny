-- Apply with the refreshed app after merchant setup, provider checks and the final
-- agreement PDF are ready. Database preparation alone preserves the old API flow.
begin;
alter table public.bookings alter column payment_status set default 'unpaid';
drop trigger if exists guard_nanny_publication on public.nannies;
create trigger guard_nanny_publication before insert or update on public.nannies
  for each row execute function public.guard_nanny_publication();
commit;
