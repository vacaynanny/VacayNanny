---
name: project-deployment
description: VacayNanny keeps the existing Vercel hosting
metadata:
  type: project
---

VacayNanny deploys to **Vercel**. The user explicitly selected keeping the existing Vercel hosting on 2026-11-18, superseding the earlier Netlify note.

Production origin: `https://www.vacaynanny.net`. Use a localhost origin for local development and a separate stable HTTPS origin for staging. Configure environment variables separately in the Vercel project's Preview and Production settings. Keep service-role, payment, email and cron secrets on the server.

`vercel.json` retains the daily booking cron at 21:30 UTC (00:30 Africa/Nairobi). Vercel authenticates it with `Authorization: Bearer <CRON_SECRET>`. Review the actual hosting plan before increasing frequency.

The user authorized local implementation, setup and preparation of the existing live Supabase project. Prefer the isolated local stack for writes and tests; the user explicitly selected the existing live Supabase project for the database rollout rather than creating another hosted project. Use the local Docker stack for pre-release validation, then coordinate live cutover with the new app and payment configuration. The initial MCP connection was read-only; expanded OAuth authorization succeeded, but migration tools must be available before making remote schema changes. Production rollout has not been performed. See `docs/deployment.md` for outstanding configuration and validation.

On 19 November 2026 the user asked whether the refresh is available to view and whether GitHub is being updated. Prepare a review branch and draft pull request and verify any Vercel preview URL. The authenticated GitHub account is leux24g; the upstream repository currently reports read-only access, so use a fork if write access remains unavailable. Do not treat a draft pull request or preview as a production release.

The database rollout is split: payments_and_agreements.sql prepares structures while preserving the old API default; security_hardening.sql tightens internal functions and public-form writes; payment_cutover.sql changes new default to unpaid and activates the publication trigger with the refreshed app/provider setup. The refreshed booking API explicitly writes unpaid. Expanded OAuth authorization succeeded, but the active tools still report transaction_read_only=on and lack apply_migration until the session reloads. No live DDL has been applied.

Paystack onboarding has not started. The user asked us to draft the nanny agreement and propose commercial terms. Draft PDF/DOCX exist under artifacts/agreements with proposed 20% platform / 80% nanny allocation and two-business-day payouts; these are not implemented deductions. Actual legal registration/address/insurance facts are unconfirmed. Keep the draft unconfigured as an email attachment until reviewed and finalised.
