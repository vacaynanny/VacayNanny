---
name: project-deployment
description: VacayNanny deploys to Netlify, not Vercel
metadata:
  type: project
---

VacayNanny Next.js app deploys to **Netlify**.

**Why:** User explicitly specified Netlify as the deployment target.

**How to apply:** When giving deployment instructions or writing config, always reference Netlify. The `netlify.toml` and `@netlify/plugin-nextjs` are already installed. Set env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://www.vacaynanny.net`) in Netlify's Site → Environment Variables UI, not in any other platform. The public site host is always `www.vacaynanny.net` — never localhost or the apex domain.
