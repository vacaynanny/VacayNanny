import PageShell from '@/components/PageShell'

export const metadata = { title: 'Privacy Policy — VacayNanny' }

export default function PrivacyPage() {
  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Legal</div>
        <h1>Privacy <em>Policy</em></h1>
        <p>How we collect, store, and use personal information. Last updated August 2026.</p>
      </section>
      <div className="sec-inner legal-copy">
        <div className="form-card">
          <h3>What we collect</h3>
          <p>Family booking details (name, email, phone, destination, dates, children). Nanny applications including identity documents, references, and certificates. Account emails if you sign up.</p>
        </div>
        <div className="form-card">
          <h3>How we use it</h3>
          <p>To match families with nannies, run background vetting, send confirmations, and improve the service. Identity documents are accessed only by the vetting team and are never shown on public profiles.</p>
        </div>
        <div className="form-card">
          <h3>Storage</h3>
          <p>Data is stored in Supabase (hosted Postgres and object storage) with row-level security. Identity files sit in a private bucket. We retain applications and bookings as long as needed for safety, tax, and dispute handling.</p>
        </div>
        <div className="form-card">
          <h3>Your rights</h3>
          <p>Email hello@vacaynanny.net to access, correct, or delete your data, subject to legal retention for vetting records.</p>
        </div>
      </div>
    </PageShell>
  )
}
