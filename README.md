# VacayNanny

Full-stack holiday nanny marketplace: Next.js on Vercel + Supabase.

## Local setup

Use Node.js 22 (`nvm use`), then:

```sh
npm ci
npm run setup:local
npm run dev:review
```

Open `http://localhost:3101`. Sign in with `operator@example.test`, `family@example.test` or `nanny@example.test`, using `local-review`, to explore the sample operations, family and nanny workspaces. This server uses a local fixture, disables database writes, email and payment calls, and never connects to the real Supabase project. The accounts exist only in the fixture server, which binds to loopback. Stop it with Ctrl+C.

`setup:local` preserves existing `.env.local` values and adds missing local defaults: a localhost site URL, disabled email delivery and a random cron secret. It does not overwrite credentials in `.env`. Use `npm run setup:check` to inspect configuration without contacting any external service. `npm run email:preview` saves the supplied application email templates to `artifacts/email-previews/index.html` without sending them.

For normal development against an authorized development database, configure the variables in `.env.example`, then run `npm run dev` on port 3000. Supabase OAuth access is now confirmed in read-only mode. The production payments/agreement migration remains pending. The isolated review command above works independently of the live database.

For integration testing against real local Supabase Auth, Storage and PostgreSQL 17 (Docker required):

```sh
npm run db:start
npm run test:integration
npm run dev:database
```

The database-backed app opens at `http://localhost:3102`. The generated workspace lives under ignored `artifacts/supabase-local/`, with API port 56321 and database port 56322. It uses a loopback-only Docker network and has no link to a hosted project. The original sample nanny seed is disabled. Use `npm run db:stop` when finished; `npm run db:reset` rebuilds only this disposable local database from the current SQL sources. The integration tests create and remove their own clearly labelled test accounts and documents.

Follow [the deployment guide](docs/deployment.md) for migration order, auth URLs and environment separation.

## What the schema covers

- `profiles` — parent / nanny / admin roles (created on signup)
- `destinations` — public coverage map
- `pricing_tiers`, `care_offerings`, `pricing_addons` — the rates used on the homepage and in booking quotes
- `faqs`, `homepage_steps`, `business_policies` — questions, process steps, and the refund / replacement rules
- `nanny_applications`, `nanny_references`, `nanny_documents` — 8-step apply flow + private file storage
- `nannies` — profiles activated after approval and review of the returned signed agreement
- `bookings` — family requests, matching, status
- `reviews`, `waitlist`, `contact_messages`

Storage buckets: `nanny-photos` (public) and `nanny-documents` (private, admin + service role).

## Deploy (Vercel)

The user confirmed keeping the existing Vercel hosting. `vercel.json` configures the Next.js build and existing daily booking job. No deployment or remote environment changes have been made during local implementation.

Use the Vercel project's separate Preview and Production environment settings. Production uses `NEXT_PUBLIC_SITE_URL=https://www.vacaynanny.net`; staging uses its own stable HTTPS address and database. Keep service-role, email, payment and cron secrets server-side. Email is disabled locally and on Vercel Preview unless explicitly enabled. Set `EMAIL_DELIVERY_MODE=send` only when the intended environment and verified sender are ready.

The existing cron schedule, `30 21 * * *` UTC, runs at **00:30 Africa/Nairobi daily**. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the production variable is configured. Query-string secrets are rejected. More frequent lifecycle updates require a supported Vercel plan and an intentional schedule change; the daily schedule is preserved for now. See [deployment details and outstanding checks](docs/deployment.md).

## UI refresh and payments

Use Node.js 22 or newer (`.nvmrc` pins the major version), then `npm ci`. The public website and operations workspace share the cream, navy, coral and sage palette. Motion uses the browser's animation API and respects reduced motion. Homepage steps and pricing have no decorative numbered labels. Specialist childcare, adult/elderly care and nursing enquiries link to the contact form with the service selected; they are quoted separately from nanny tiers.

The destination section includes four AI-generated travel scenes, descriptive cards and enquiries for locations that are not active in the catalogue. Configured destination photos take priority. The nanny directory uses a contained filter/results layout, and missing profile photos use initials rather than an unrelated caregiver image. On desktop, the application page keeps its image fixed while its form scrolls; tablet and mobile use normal page scrolling. Asset paths and the full generation prompts are recorded in [docs/image-assets.json](docs/image-assets.json).

The shared sign-in, signup and password recovery pages use a generated coastal-veranda scene across the full page, with the form on a soft cream panel. Desktop keeps the form to the right of the scene; mobile centres it over the backdrop. The responsive browser suite covers 320–2560px widths, every operations panel, family and nanny portals, all application steps, and short landscape overlays. See [the responsive review](docs/responsive-review.md) for the checked layouts and local sample accounts.

The homepage and nanny application image panels each show three page-specific marketing scenes. They crossfade over 1.4 seconds on a seven-second cycle and loop automatically. There are no next/previous buttons or pagination dots. A pause/resume button allows still viewing; reduced-motion preferences show a static image. Rotation stops while the tab is hidden or the panel is outside the viewport, and unloaded/failed images are skipped. The sign-in background has no visible generation label; its source and prompt remain in `docs/image-assets.json`.

### Booking and onboarding safeguards

The workflow migration in `supabase/migrations/20261119075620_workflow_integrity.sql` accompanies this application release. It adds version-checked booking mutations, unique nanny/day reservations, individual assignment slots for up to three nannies, separate admin suspension controls, application verification records, an encrypted notification queue, operations follow-ups and specialist quote states. Apply it after the existing preparatory migrations; it has not been applied to production.

Booking ownership uses the verified Auth email rather than editable profile data. Requests and assignments validate dates, working weekdays, tier, child capacity and infant/overnight experience. Specialist needs go through individual assessment. Rescheduling clears the family and all nanny acceptances. Every requested nanny must be assigned and accept before a family-confirmed placement becomes confirmed. The database prevents concurrent double-booking, and conflict responses contain no other family's details. Match proposals expire after a maximum of 24 hours; replacement follow-ups remain open until the replacement is accepted.

The application form validates all steps on submission, uploads directly to private Storage using signed URLs, checks actual file bytes/size on the server and commits the application, references and document records together. This avoids sending all identity files through Vercel's request-size limit. Uploads expire after two hours; a delayed job removes abandoned files while preserving committed documents. Headshots become public only during approved profile publication. Submission keys prevent retry duplicates; an uncertain database response preserves files for reconciliation. Applicants who register later can link their existing application through their verified Auth email. Approval requires recorded identity, clearance, reference, interview and qualification checks; activation also requires the reviewed signed agreement.

Operations has a Follow-ups panel for expired proposals, overdue replacement deadlines, suspension impacts and failed notifications. Changes and their actor are recorded in the workflow audit. Notification jobs have leases, retries and recipient deduplication; private links/email bodies are encrypted. Set a stable server-only `NOTIFICATION_ENCRYPTION_KEY` before production. Keep this key while queued notifications and specialist enquiry links exist. Local development can fall back to the service-role key. Approval timestamps represent provider acceptance, never an intentionally skipped preview send. Completed transient jobs are removed after 30 days; core booking/application records are retained.

Specialist enquiries now move through assignment, assessment, quote, family acceptance and fulfilment. Operators record provider verification and a complete scope, service dates, total and expiry. Families can review through their account or a private enquiry link. Private assessment/provider-verification notes are never returned in the family view. Expired/stale quotes cannot be accepted, and accepted terms cannot be silently changed.

Enable `supabase/workflow_schedule.sql` at deployment after configuring the HTTPS site origin and cron secret in Supabase Vault. Its minute-level jobs release expired holds, escalate replacement deadlines and call `/api/cron/workflows` to process notifications and abandoned uploads. The existing daily Vercel job remains a fallback; it cannot provide timely replacement escalation by itself. Full configuration and migration sequencing are in [the deployment guide](docs/deployment.md).

### Database preparation and activation

After the existing migrations, apply `supabase/payments_and_agreements.sql`, then `supabase/security_hardening.sql`, to the target database after local validation. Activate `supabase/payment_cutover.sql` with the refreshed application once merchant setup and the agreement document are ready. This migration is additive and has **not** been applied to production by the local implementation. It introduces payment attempts, secure guest access and agreement review records, plus database guards for payment and publication. Browser clients must use the existing server APIs for bookings, applications, nanny changes and public-form submissions. Internal trigger functions cannot be invoked through browser RPC calls. Self-service role changes are rejected. Existing bookings keep `not_required` as their historical payment arrangement; the refreshed booking API explicitly saves new requests as `unpaid`. Database preparation preserves the old deployed API’s default until `payment_cutover.sql` changes it to `unpaid`. The nanny publication trigger is also installed at that cutover. Review historical balances separately rather than assuming they were paid.

Configure the new variables in `.env.example`. Keep the Paystack secret and webhook signing secret on the server. No public Paystack key is needed for hosted checkout. Use a Kenyan Paystack account with **card** and **mobile money** enabled, and enable international payments in Paystack for international Visa/Mastercard acceptance. All booking amounts are collected in KES; M-Pesa is offered through `mobile_money`. There is no automatic currency conversion, commission split or nanny payout implementation.

Set Paystack's webhook URL to `https://www.vacaynanny.net/api/payments/webhook` (use your staging address in test mode). Checkout returns to `/payments/return`. `NEXT_PUBLIC_SITE_URL` controls generated callback and email links; use the correct staging URL locally. Webhooks verify the raw request bytes. When `PAYSTACK_WEBHOOK_SECRET` is set, the timestamped `Paystack-Signature` header is mandatory, with a five-minute replay limit. Without it, legacy `x-paystack-signature` is verified using the Paystack secret key. Never disable signature checking.

Apply `supabase/payment_cutover.sql` with the refreshed app after the merchant and approved agreement are configured. Database preparation can happen first while preserving the old app’s booking behavior.

Families accept the nanny match first. Checkout becomes available when the family and nanny have accepted and the booking is confirmed. The server snapshots the saved quote, charges that amount in KES subunits, and verifies the provider's reference, amount and currency before recording payment. The existing lifecycle uses midnight Africa/Nairobi on the check-in date as its date-only start boundary; unpaid bookings cannot progress into care. A specific shift-time model would require a separate scheduling change.

Pending checkout attempts are reused. Repeat requests cannot create another pending attempt for the same booking. Definitively failed/abandoned attempts can be retried after provider verification. An ambiguous initialization remains pending for reconciliation instead of creating a second charge. A late successful payment on a cancelled booking is recorded for refund review. Cancellation records refund eligibility; **it does not transfer money**. Refund execution and nanny payouts remain manual until those business rules are confirmed.

Guest request confirmation includes a private tracking link and optional signup. Only a hash of its 256-bit random token is stored. The link permits viewing, accepting, cancelling and paying for that booking. It is excluded from indexing and uses a no-referrer policy. Guests use their existing link after returning from checkout, with an in-tab shortcut when session storage is available. Signed-in, email-verified accounts can also see matching guest bookings through the existing account ownership checks. Guest messaging/reviews still use the signed-in flows.

### Application emails and signed agreements

The received and approved emails use the supplied templates. To send approval emails, upload the final **blank agreement PDF** to the private `nanny-documents` bucket and set `NANNY_AGREEMENT_STORAGE_PATH` to its path. Resend must be configured with the verified sending domain and `EMAIL_DELIVERY_MODE=send`. `RESEND_FROM_EMAIL` selects the verified sender and `RESEND_REPLY_TO_EMAIL` configures the default reply address. Approval emails attach the PDF and set Reply-To to `hello@vacaynanny.net` so the nanny can return the signed copy.

Approval no longer publishes a profile. An administrator opens the application, uploads the returned signed PDF, confirms they have reviewed it, then activates the profile. Reviewer and timestamp are recorded; the database prevents publication without this review. Existing active profiles are preserved. A review draft has now been authored in PDF and editable DOCX form under `artifacts/agreements/`, with source in `docs/legal/`. It proposes commercial terms and keeps actual registration/insurance details open. It is not configured as the official attachment; complete business/legal review before issuing an approved PDF and enabling approval-email delivery.

### Validation

- `npm run lint` — ESLint.
- `npm run test:integration` — actual local Supabase Auth, Data API, private Storage, role permissions and payment functions. Requires `npm run db:start`; never uses credentials from the real project.
- `npm run typecheck` — TypeScript.
- `npm test` — payment/guest/email rules, mocked Paystack calls and actual PostgreSQL migration/guard tests using an in-memory PGlite database.
- `npm run test:e2e` — responsive discovery, specialist quotes, keyboard-accessible booking, guest tracking and the authenticated operations workspace. Uses an isolated local Supabase fixture and dummy credentials; it does not write to production. Local runs use system Chrome when available; otherwise install Chromium with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. CI installs its own browser.
- `npm run build` — production build.

Before deployment, complete Paystack sandbox M-Pesa and card transactions, an enabled international card transaction, delayed/retried webhooks, cancelled payments and delivered agreement emails against staging. These external checks require the business account and the final agreement PDF. Next.js was patched from 16.4.0 to 16.4.6 after the dependency audit identified security advisories.

GitHub Actions runs lint, type checks, unit/database tests, the production build and browser tests without production credentials. It saves email previews, screenshots and failure traces as review artifacts. The workflow has been prepared locally; it will run on GitHub after the changes are pushed.

Payment implementation follows Paystack’s [transaction API](https://paystack.com/docs/api/transaction/) and [webhook verification documentation](https://paystack.com/docs/payments/webhooks/). International cards require [international payments activation](https://support.paystack.com/en/articles/2130690).
