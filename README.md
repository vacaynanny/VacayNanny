# VacayNanny

Full-stack holiday nanny marketplace: Next.js (Netlify) + Supabase.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase project URL, anon key, and service role key. Add a Resend key if you want emails.
2. In the [Supabase SQL editor](https://supabase.com/dashboard), run `supabase/schema.sql`, then `supabase/seed.sql`.
3. Under Authentication → URL configuration, set the Site URL to `https://www.vacaynanny.net` and add `https://www.vacaynanny.net/auth/callback`. Password-reset emails reuse that callback (`?next=/reset-password`).
4. After you create the first user, promote them:

```sql
update public.profiles set role = 'admin' where email = 'you@email.com';
```

5. `npm install && npm run dev`

## What the schema covers

- `profiles` — parent / nanny / admin roles (created on signup)
- `destinations` — public coverage map
- `nanny_applications`, `nanny_references`, `nanny_documents` — 8-step apply flow + private file storage
- `nannies` — live profiles published when an application is approved
- `bookings` — family requests, matching, status
- `reviews`, `waitlist`, `contact_messages`

Storage buckets: `nanny-photos` (public) and `nanny-documents` (private, admin + service role).

## Deploy (Netlify)

Set the same env vars in Site → Environment variables, including `NEXT_PUBLIC_SITE_URL=https://www.vacaynanny.net`. Point the production auth callback to `https://www.vacaynanny.net/auth/callback` (also used for password reset).
