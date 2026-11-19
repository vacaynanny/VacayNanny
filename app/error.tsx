'use client'
import Link from 'next/link'

export default function ErrorPage({
  retry,
}: {
  error: unknown
  retry: () => void
}) {
  return (
    <main className="status-page" id="main-content">
      <p className="account-kicker">Let&apos;s try that again</p>
      <h1>Something needs a moment.</h1>
      <p>
        We couldn&apos;t load this page. Try again, or return to the homepage to
        continue your plans.
      </p>
      <div className="booking-actions">
        <button className="btn-coral" onClick={retry}>
          Try again
        </button>
        <Link href="/" className="btn-ghost">
          Back to VacayNanny
        </Link>
      </div>
    </main>
  )
}
