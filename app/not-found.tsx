import Link from 'next/link'
import PageShell from '@/components/PageShell'
import CareIcon from '@/components/CareIcon'

export default function NotFound() {
  return (
    <PageShell>
      <section className="status-page">
        <CareIcon kind="sun" />
        <p className="account-kicker">A little detour</p>
        <h1>We couldn&apos;t find that page.</h1>
        <p>
          The link may have changed. Let&apos;s get you back to planning
          something lovely.
        </p>
        <div className="booking-actions">
          <Link href="/" className="btn-coral">
            Back to VacayNanny
          </Link>
          <Link href="/contact" className="btn-ghost">
            Contact our team
          </Link>
        </div>
      </section>
    </PageShell>
  )
}
