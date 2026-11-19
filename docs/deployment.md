# VacayNanny on Vercel

The existing Vercel hosting is the confirmed deployment target. These instructions prepare a later rollout; no remote deployment or database migration has been performed by the local refresh.

## Review locally

```sh
nvm use
npm ci
npm run setup:local
npm run setup:check
npm run email:preview
npm run dev:review
```

Review the public site at `http://localhost:3101`. Sign in to `/login?next=/admin` with the local sample credentials `operator@example.test` / `local-review`. This fixture server binds to `127.0.0.1`, uses dummy keys and sample data, rejects writes, and disables email and payments. It is never used by `npm run build` or a deployed app. `npm run dev` uses the configured database instead; use the review command for sample data, or the isolated database workflow below for real service integration.

Email previews are saved under `artifacts/email-previews/`. They use the supplied wording and a sample name. The agreement attachment itself is pending the final document.

## Environment settings

The user selected the existing Supabase project for the eventual database rollout. The local Docker stack provides pre-release database validation. Keep Vercel Preview and Production environment settings separate; use a stable HTTPS preview address for controlled provider tests. Any preview pointed at the existing project shares live data, so use labelled test records, disabled notifications and Paystack test credentials for those checks.

| Variable                                                    | Preview / staging                                                 | Production                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                      | Stable staging HTTPS origin                                       | `https://www.vacaynanny.net`                                                  |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Isolated local stack or controlled existing-project tests         | Existing production project                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                 | Corresponding server-only key                                     | Production server-only key                                                    |
| `EMAIL_DELIVERY_MODE`                                       | `disabled`; explicitly enable for controlled delivery checks      | `send` after sender verification                                              |
| `RESEND_API_KEY`                                            | Test sender key if checking delivery                              | Key for verified domain                                                       |
| `RESEND_FROM_EMAIL`                                         | Verified staging sender                                           | `VacayNanny <noreply@vacaynanny.net>` after verification                      |
| `RESEND_REPLY_TO_EMAIL`                                     | Monitored staging inbox                                           | `hello@vacaynanny.net`                                                        |
| `PAYSTACK_SECRET_KEY`                                       | Merchant `sk_test_...` key                                        | Merchant `sk_live_...` key                                                    |
| `PAYSTACK_WEBHOOK_SECRET`                                   | Test endpoint's `whsec_...` secret, when available                | Live endpoint's `whsec_...` secret, when available                            |
| `NANNY_AGREEMENT_STORAGE_PATH`                              | Final blank PDF in the private bucket                             | Approved document's private path                                              |
| `NOTIFICATION_ENCRYPTION_KEY`                               | Stable server-only random key; preserve while testing queued jobs | Stable server-only random key; preserve for queued jobs/private enquiry links |
| `CRON_SECRET`                                               | Separate random value if manually testing                         | Separate random value, at least 32 characters                                 |

By default, the setup checker reports presence and formats without printing values, connecting to Supabase, sending mail or attempting a payment:

```sh
npm run setup:check -- --target=staging
npm run setup:check -- --target=production
```

Run these commands with the intended environment loaded. They deliberately exit unsuccessfully while required configuration or database schema verification remains outstanding. Add `--database` for read-only schema checks using the configured URL and server key; the default remains configuration-only. Schema checks select zero rows and inspect the API schema without invoking payment functions. A key with the right prefix is not proof of account capabilities or successful delivery.

Only variables beginning `NEXT_PUBLIC_` are intended for the browser. Never add that prefix to a service-role, payment, email or cron secret. Redeploy after changing Vercel environment variables so the deployment picks them up.

## Isolated local database

The Supabase CLI is pinned to 3.2.0. Docker must be running. These commands use a generated, unlinked workspace under `artifacts/supabase-local/` and never use the hosted project as a write target:

```sh
npm run db:start
npm run test:integration
npm run dev:database
npm run db:stop
```

The app uses port 3102; the API uses 56321, PostgreSQL uses 56322 and the local mail viewer uses 56324. The Docker network binds published services to loopback. Other Docker projects are left alone. Outgoing application email is disabled. The app launcher accepts only a Paystack test key if one is configured, and overrides the project's Supabase values with the local credentials in memory.

`db:start` assembles the existing SQL sources into one generated bootstrap migration. It deliberately disables the legacy sample nanny seed, which contains invented ratings. `db:reset` rebuilds this disposable local database when SQL sources change. It removes local test data; it does not reset any hosted project. Stop local review processes before resetting. Starting an already running stack does not reapply changed SQL.

Integration tests create synthetic users through the actual Auth API, check policy helpers and role guards, upload a clearly labelled test document into private Storage, verify the agreement publication gate and exercise the payment functions through PostgREST. The local bootstrap includes final cutover so the complete enforced behavior is tested. Test payment settlement is simulated by the privileged database function; these tests do not establish merchant M-Pesa/card acceptance. The test document is never substituted for the official agreement PDF.

## Hosted database rollout

The existing project has been inspected through read-only MCP. Its current 211 public-table columns match the local baseline; the original payment preparation adds 17 columns without removing existing column types. The separate workflow migration adds the assignment, reservation, notification, assessment and operations structures described below. Private application-data snapshots, a checksum, schema metadata and function definitions are saved under ignored `artifacts/`. The application-data export excludes Auth users and Storage file bytes and is not a transactionally consistent managed backup. Confirm backup/restore coverage for the intended release.

For this existing project, the preparatory application changes are `payments_and_agreements.sql` followed by `security_hardening.sql`; earlier schema/catalog/lifecycle objects are already present. Preparation keeps the old deployed API’s new bookings at `not_required` for its existing payment arrangement. The refreshed booking API explicitly saves `unpaid`. Apply `payment_cutover.sql` with the refreshed app after merchant setup and the approved agreement are ready: it changes the database default to `unpaid` and installs the signed-agreement publication trigger. The payment guard already prevents an explicitly unpaid booking from entering care. Preparation does not remove any already installed publication guard.

For a fresh project, compare the existing schema against the migrations. Do not rerun seed data blindly against an existing project. Test on staging in this order, skipping already applied migrations after confirming their schema:

1. `supabase/schema.sql`
2. `supabase/content_catalog.sql`
3. `supabase/booking_lifecycle.sql`
4. `supabase/messaging_and_automation.sql`
5. `supabase/payments_and_agreements.sql`
6. `supabase/security_hardening.sql`
7. `supabase/payment_cutover.sql` at the coordinated application/payment release
8. `supabase/migrations/20261119075620_workflow_integrity.sql` with the refreshed workflow application
9. `supabase/workflow_schedule.sql` after the refreshed endpoint and Vault settings are ready

`supabase/seed.sql` is optional sample/bootstrap data for a new development project. Existing bookings retain historical `not_required` payment status. Review their real balances separately. New bookings require payment after the family and nanny accept the match and before the date-only start boundary.

Verify policies, private storage access, new RPC permissions, application agreement fields and payment guards in staging. Upload the final blank agreement PDF to the private `nanny-documents` bucket and configure its path. Existing active nanny profiles are preserved; new profiles require approval and administrator review of the returned signed agreement before activation.

In each Supabase project's Authentication URL settings, set its corresponding Site URL and allow `/auth/callback` on that origin. Password reset uses the same callback with `?next=/reset-password`. Enable email confirmation for password signup; verified-email guest booking/application claims deliberately reject automatically confirmed accounts that never proved ownership of the address. Create and verify the first administrator through the existing process, then have an authorized database operator set their role:

```sql
update public.profiles set role = 'admin' where email = 'the-authorized-admin@example.com';
```

## Payments and email

In Paystack, configure the staging and production webhook endpoints separately at `/api/payments/webhook`; return links use `/payments/return`. Enable M-Pesa/mobile money and cards for the Kenyan merchant account. International Visa/Mastercard acceptance depends on merchant account approval. All booking charges use KES.

Complete test-mode M-Pesa and card payments, failure/cancellation, retries and duplicate/delayed webhooks against staging. Confirm strict reference, amount and currency verification, and check the payment ledger and booking state. Account-enabled international cards also need verification before launch. Refund execution and nanny payouts remain manual; the app records refund review status without claiming a transfer occurred.

Verify the Resend domain and deliver both application templates to a controlled inbox. Confirm the approval message carries the actual PDF, replies reach the monitored inbox, and the profile remains unpublished until the signed agreement has been reviewed.

## Booking scheduler

The checked-in daily schedule is `30 21 * * *` UTC, or **00:30 Africa/Nairobi**. Vercel cron runs against production deployments and supplies the `Authorization: Bearer <CRON_SECRET>` header when that variable is configured. URL query secrets are rejected.

The daily Vercel invocation is a fallback. Minute-level workflow processing uses Supabase Cron, so it does not depend on upgrading the Vercel plan. Before enabling `supabase/workflow_schedule.sql`, store the exact deployed HTTPS origin as `vacaynanny_site_url` and the matching server `CRON_SECRET` as `vacaynanny_cron_secret` in Supabase Vault. Keep both values server-side; do not put them in the SQL file, browser code, GitHub or chat. The script checks configuration and schedules separate minute jobs for deadline enforcement and authenticated notification processing. Run it only when the refreshed `/api/cron/workflows` endpoint is deployed. Applying schema alone does not enable the worker.

Verify both entries in `cron.job`, recent `cron.job_run_details`, and HTTP outcomes in `net._http_response`; successful submission of a pg_net request is not proof that the HTTP worker succeeded. Check the queue and Follow-ups panel as well. Lease expiry recovers interrupted work, failed jobs back off and surface after eight attempts, and retries reuse the provider idempotency key. A manual retry asks the operator to check delivery logs first. Disabled email mode leaves notifications queued, while abandoned-upload cleanup can still run. A failed lifecycle update does not prevent draining pending notifications.

Before migration, review existing active/hidden nanny profiles and booking overlaps. Existing active profiles are preserved; legacy hidden profiles require an operator restore. Conflicting legacy reservations and incomplete confirmations produce explicit operations tasks. No booking is deleted or silently treated as accepted. Complete verification evidence and signed-agreement review before restoring/publishing a profile. Changes to consent, dates and staffing now use the server workflow APIs; direct client writes remain denied.

References: [Supabase Cron with Vault and pg_net](https://supabase.com/docs/guides/functions/schedule-functions), [Vercel cron authentication and management](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [cron usage and plan limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Verification and rollout

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For an isolated build, explicitly clear the Supabase URL and keys in the command environment. The GitHub Actions workflow already does this and uses only local fixtures for browser tests. A separate job starts the Docker stack and runs the real local integration suite. It requires no production secrets and saves review artifacts for seven days. A local test run does not confirm that the workflow has run on GitHub.

Before production rollout, complete staging checks, resolve the pending provider configuration and signed agreement document, and review the resulting public/admin screens. Deployment, live credentials and production migrations remain separate steps once local work has been reviewed.

## Agreement draft

The user requested creation of the nanny agreement and proposed commercial terms. The editable source is `docs/legal/nanny-agreement-draft.json`; `scripts/generate-agreement.py` renders PDF, DOCX and separate review notes under ignored `artifacts/agreements/`.

```sh
python3 -m venv --system-site-packages artifacts/agreement-tools
artifacts/agreement-tools/bin/pip install -r docs/legal/requirements.txt
artifacts/agreement-tools/bin/python scripts/generate-agreement.py
```

The draft proposes a 20% platform allocation within the family care charge, 80% nanny compensation, full approved-expense reimbursement and payout within two Kenyan business days after care, with weekly settlement for longer bookings. These proposals have not been implemented as fee deductions or automated payouts. Actual legal identity, address, verified insurance details and legal classification require completion and review. No registration details or insurance coverage have been fabricated. Do not configure the draft as the approval attachment; issue an approved version after review.
