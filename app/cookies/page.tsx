import PageShell from '@/components/PageShell'

export const metadata = { title: 'Cookie Policy — VacayNanny' }

export default function CookiesPage() {
  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Legal</div>
        <h1>Cookie <em>Policy</em></h1>
      </section>
      <div className="sec-inner legal-copy">
        <div className="form-card">
          <h3>What we use</h3>
          <p>Essential cookies keep you signed in (Supabase auth). We do not run third-party advertising cookies. Analytics, if added later, will be listed here.</p>
        </div>
      </div>
    </PageShell>
  )
}
