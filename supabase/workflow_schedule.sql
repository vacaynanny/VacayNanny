-- Run after the workflow migration, with the refreshed Vercel deployment ready.
-- Store the HTTPS site origin as `vacaynanny_site_url` and the matching Vercel
-- CRON_SECRET as `vacaynanny_cron_secret` in Supabase Vault first.
-- This script never embeds credentials in cron.job.command.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
declare site text; token text;
begin
 select decrypted_secret into site from vault.decrypted_secrets where name='vacaynanny_site_url' limit 1;
 select decrypted_secret into token from vault.decrypted_secrets where name='vacaynanny_cron_secret' limit 1;
 if site is null or site !~ '^https://[^/]+/?$' or token is null or length(token)<32 then
  raise exception 'Configure the HTTPS site URL and matching cron secret in Vault before enabling the worker.';
 end if;
end $$;
select cron.schedule('vacaynanny-workflow-deadlines','* * * * *',$job$select public.run_workflow_automation();$job$);
select cron.schedule('vacaynanny-notification-worker','* * * * *',$job$
 select net.http_post(
  url:=rtrim((select decrypted_secret from vault.decrypted_secrets where name='vacaynanny_site_url' limit 1),'/')||'/api/cron/workflows',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='vacaynanny_cron_secret' limit 1)),
  body:='{}'::jsonb,timeout_milliseconds:=65000
 );
$job$);
commit;
