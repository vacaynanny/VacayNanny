import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import PageShell from '@/components/PageShell'
import SafeguardingModule from '@/components/SafeguardingModule'
import Link from 'next/link'
import type { Nanny } from '@/lib/types'

export const metadata = { title: 'Safeguarding training — VacayNanny' }

export default async function SafeguardingPage() {
  const profile = await requireProfile(['nanny', 'admin'])
  let nanny: Nanny | null = null
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from('nannies').select('*').eq('user_id', profile.id).maybeSingle()
    nanny = data as Nanny | null
  } catch {}

  return (
    <PageShell>
      <section className="page-hero">
        <Link href="/nanny" className="nav-back" style={{ justifyContent: 'center', marginBottom: 16 }}>← Nanny dashboard</Link>
        <div className="eyebrow">Elite requirement</div>
        <h1>Safeguarding <em>module</em></h1>
        <p>Gold-tier nannies complete this short course before the Elite badge goes live on the public profile.</p>
      </section>
      <div className="sec-inner dash-page">
        {!nanny && (
          <div className="form-card">
            <h3>Profile not live yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
              Finish vetting first. Once your profile is approved, return here to complete safeguarding.
            </p>
          </div>
        )}
        {nanny && <SafeguardingModule alreadyComplete={Boolean(nanny.safeguarding_completed_at)} />}
      </div>
    </PageShell>
  )
}
