import PageShell from '@/components/PageShell'
import Link from 'next/link'

export const metadata = { title: 'About — VacayNanny' }

export default function AboutPage() {
  return (
    <PageShell>
      <section className="page-hero">
        <div className="eyebrow">Our story</div>
        <h1>Holiday childcare that actually feels like a <em>holiday</em></h1>
        <p>VacayNanny is Kenya&apos;s dedicated platform for vetted nannies at beaches, safari camps, and city hotels.</p>
      </section>
      <div className="sec-inner legal-copy">
        <div className="form-card">
          <h3>Why we exist</h3>
          <p>Parents travelling with children should not have to choose between safety and rest. We built VacayNanny so families can book ID-verified, reference-checked carers at the destinations they already love — Diani, Watamu, the Mara, Nairobi, and beyond.</p>
        </div>
        <div className="form-card">
          <h3>How nannies are vetted</h3>
          <p>Every applicant submits national ID, a selfie check, references, and (for Professional and Elite tiers) a Certificate of Good Conduct. Our team reviews documents, calls referees, and interviews before a profile goes live. Gold-tier nannies hold paediatric first aid and travel documents.</p>
        </div>
        <div className="form-card">
          <h3>For hotels and lodges</h3>
          <p>We partner with properties that want a reliable childcare option for guests. <Link href="/contact">Talk to us about partnerships</Link>.</p>
        </div>
      </div>
    </PageShell>
  )
}
