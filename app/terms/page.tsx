import PageShell from '@/components/PageShell'

export const metadata = { title: 'Terms of Service — VacayNanny' }

export default function TermsPage() {
  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Legal</div>
        <h1>Terms of <em>Service</em></h1>
        <p>By booking or applying you agree to these terms. Last updated August 2026.</p>
      </section>
      <div className="sec-inner legal-copy">
        <div className="form-card">
          <h3>Bookings</h3>
          <p>A request is not confirmed until VacayNanny matches a nanny and you accept. Cancellations: full refund 48+ hours before start; 50% within 24–48 hours; no refund under 24 hours except verified emergency. We guarantee a replacement nanny within 2 hours of a no-show or refund the booking fee.</p>
        </div>
        <div className="form-card">
          <h3>Payments</h3>
          <p>Pay VacayNanny, never the nanny directly. This keeps the quality guarantee in force. Nannies are paid after completed placements.</p>
        </div>
        <div className="form-card">
          <h3>Nanny code of conduct</h3>
          <p>Nannies must provide accurate information, keep children safe, follow family instructions, and never share family details. False documents or unsafe conduct lead to immediate removal.</p>
        </div>
        <div className="form-card">
          <h3>Liability</h3>
          <p>VacayNanny vets nannies and facilitates bookings. We are not a substitute for parental judgement on-site. International travel costs (flights, visas, lodging) are the family&apos;s responsibility unless agreed in writing.</p>
        </div>
      </div>
    </PageShell>
  )
}
