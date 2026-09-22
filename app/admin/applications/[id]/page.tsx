import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
import { sortDocuments } from '@/lib/application-docs'
import PageShell from '@/components/PageShell'
import AdminApplicationReview from '@/components/AdminApplicationReview'
import type { NannyApplication, NannyDocument, NannyReference } from '@/lib/types'

export const metadata = { title: 'Review application — VacayNanny' }

export default async function AdminApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireProfile(['admin'])
  const { id } = await params

  let application: NannyApplication | null = null
  let references: NannyReference[] = []
  let documents: NannyDocument[] = []
  try {
    const supabase = createServerClient()
    const { data: app } = await supabase.from('nanny_applications').select('*').eq('id', id).maybeSingle()
    application = (app as NannyApplication | null) ?? null
    if (application) {
      const [{ data: refs }, { data: docs }] = await Promise.all([
        supabase.from('nanny_references').select('*').eq('application_id', id).order('sort_order'),
        supabase.from('nanny_documents').select('*').eq('application_id', id),
      ])
      references = (refs || []) as NannyReference[]
      documents = sortDocuments((docs || []) as NannyDocument[])
    }
  } catch {}

  if (!application) notFound()

  return (
    <PageShell>
      <section className="page-hero">
        <Link href="/admin" className="nav-back" style={{ justifyContent: 'center', marginBottom: 16 }}>← All applications</Link>
        <div className="eyebrow">Vetting</div>
        <h1>{application.full_name}</h1>
        <p>{application.email} · {application.status} · {application.estimated_tier}</p>
      </section>
      <div className="sec-inner dash-page">
        <AdminApplicationReview
          application={application}
          references={references}
          documents={documents}
        />
      </div>
    </PageShell>
  )
}
