# Database readiness — 19 November 2026

The user chose the existing VacayNanny Supabase project (`eejvcawtqkpucqgsaqzp`) for the eventual rollout. No second hosted project was created. No live schema migration or production deployment has been performed during this work.

## Verified locally

- Read-only access to the intended hosted project was verified. Its 211 baseline public-table columns match the local schema types. The earlier payment preparation adds 17 columns; the separate workflow migration adds assignment, reservation, verification, notification, specialist assessment and operations structures without deleting existing bookings.
- Private application-data snapshots cover 18 existing public tables, with a verified SHA-256 checksum and file permissions `0600`. These exports exclude Auth users, Storage file bytes and platform settings and are not transactionally consistent managed backups. Schema metadata and existing function definitions are also saved under ignored `artifacts/database-review/`.
- A real local Supabase stack runs PostgreSQL 17, Auth, PostgREST and private Storage on a Docker network bound to loopback. Its generated bootstrap includes all checked-in schema sources and the workflow migration; the hosted project's migration history remains unchanged.
- **46 unit tests, 21 real database integration tests and 38 browser tests passed.** Database coverage includes concurrent family/nanny acceptance, competing reservations, rescheduling consent, every requested care slot, suspension, proposal expiry, replacement escalation, verified-email application claims, atomic application/reference/document saves, signed private uploads, abandoned-upload cleanup, specialist quote acceptance and notification lease recovery. Existing payment guards are regression-tested locally without calling a merchant gateway.
- Auth-derived identity replaces editable profile email in ownership and notification routing. Browser regressions also verify that a tampered profile email cannot disclose another family's specialist care plan and that private operator assessment/provider notes never reach the family view.
- The final local security advisor reports no warnings or errors. RLS and server-only function privileges protect the workflow queue, reservation slots, operations tasks and audit records.
- ESLint, TypeScript and the production build passed. Browser checks cover the public site, all twelve operations panels and populated family/nanny workflows at phone, tablet and desktop widths; see [responsive review](responsive-review.md).

These checks establish local behavior. They do not establish delivery through the production email provider, enabled hosted scheduling, merchant payment capabilities or a completed live rollout.

## Release sequence

1. Confirm recoverable backup coverage and review the existing hosted schema and legacy booking/profile state. Review the drafted agreement and configure the approved blank PDF before application approvals.
2. Apply `supabase/payments_and_agreements.sql`, then `supabase/security_hardening.sql`, skipping only changes already confirmed present. Preparatory changes preserve the old deployed API's historical payment arrangement.
3. Coordinate the refreshed application, `supabase/payment_cutover.sql` and `supabase/migrations/20261119075620_workflow_integrity.sql`. The workflow migration relies on the existing payment/agreement structures and publication trigger. Existing active profiles are preserved; hidden profiles require operations review. Conflicting legacy assignments and incomplete confirmations create follow-up tasks rather than deleting records or fabricating consent.
4. Configure a stable `NOTIFICATION_ENCRYPTION_KEY`, the verified email sender, `CRON_SECRET` and the corresponding Supabase Vault entries described in [deployment instructions](deployment.md). Enable Auth email confirmations and the intended callback origins: an automatically confirmed password account is deliberately insufficient evidence for claiming guest records.
5. Once the refreshed `/api/cron/workflows` endpoint is deployed, apply `supabase/workflow_schedule.sql`. This enables minute-level deadline and notification workers. Verify cron execution, HTTP outcomes, queue progress and the operations Follow-ups panel; applying schema alone does not enable the worker.
6. Verify hosted API permissions, private document access, advisors and legacy record preservation, then run controlled application/booking/email smoke checks. Payment activation requires the separate merchant onboarding and sandbox checks already documented.

## External dependencies

The current MCP tool catalogue exposes read-only database access; hosted migrations have not been attempted through the SQL query tool. Use an authorized migration-capable connection for the coordinated release.

Paystack onboarding has not started, as confirmed by the user. No merchant M-Pesa or international-card acceptance has been tested. The agreement remains a draft for business and Kenyan legal review, not an approved onboarding attachment. Leaked-password protection was reported disabled by the earlier live advisor; its availability/settings still need release review.

Relevant advisor references: [internal function permissions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [function search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [RLS without client policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
