'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  cogcLabel,
  documentKindLabel,
  formatNairobiInterview,
  isPdf,
  isPreviewableImage,
  joinList,
  toNairobiDatetimeLocal,
  travelLabel,
} from '@/lib/application-docs'
import { waLinkTo } from '@/lib/constants'
import type { ApplicationStatus, NannyApplication, NannyDocument, NannyReference } from '@/lib/types'

const APP_STATUSES: ApplicationStatus[] = ['pending', 'reviewing', 'interview', 'approved', 'rejected']

function fileHref(applicationId: string, docId: string, download = false) {
  return `/api/admin/applications/${applicationId}/files/${docId}${download ? '?download=1' : ''}`
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="review-row">
      <span className="review-key">{label}</span>
      <span className="review-val">{value || '—'}</span>
    </div>
  )
}

export default function AdminApplicationReview({
  application,
  references,
  documents,
}: {
  application: NannyApplication
  references: NannyReference[]
  documents: NannyDocument[]
}) {
  const router = useRouter()
  const [notes, setNotes] = useState(application.admin_notes || '')
  const [interviewAt, setInterviewAt] = useState(toNairobiDatetimeLocal(application.interview_at))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<NannyDocument | null>(null)

  async function patch(body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey)
    setError('')
    try {
      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not save this application.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="profile-layout">
      <div>
        {error && <p className="field-error-msg" style={{ marginBottom: 16 }}>{error}</p>}

        <div className="form-card">
          <h3>Identity & documents</h3>
          {documents.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No files were uploaded with this application.</p>
          )}
          <div className="vetting-docs">
            {documents.map(doc => {
              const href = fileHref(application.id, doc.id)
              const image = isPreviewableImage(doc)
              return (
                <article className="vetting-doc" key={doc.id}>
                  {image ? (
                    <button type="button" className="vetting-doc-preview" onClick={() => setPreview(doc)}>
                      <img src={href} alt={documentKindLabel(doc.kind)} />
                    </button>
                  ) : (
                    <a className="vetting-doc-preview vetting-doc-file" href={href} target="_blank" rel="noopener noreferrer">
                      {isPdf(doc) ? 'PDF' : 'File'}
                    </a>
                  )}
                  <p className="vetting-doc-kind">{documentKindLabel(doc.kind)}</p>
                  <p className="vetting-doc-name">{doc.file_name || doc.kind}</p>
                  <div className="booking-actions" style={{ marginTop: 8 }}>
                    <a className="btn-ghost" href={href} target="_blank" rel="noopener noreferrer">Open</a>
                    <a className="btn-ghost" href={fileHref(application.id, doc.id, true)}>Download</a>
                  </div>
                </article>
              )
            })}
          </div>
          <div className="review-row" style={{ marginTop: 16 }}>
            <span className="review-key">National ID</span>
            <span className="review-val">{application.national_id_number || '—'}</span>
          </div>
          <Row label="KRA PIN" value={application.kra_pin} />
          <Row label="Police clearance" value={`${cogcLabel(application.cogc_status)}${application.cogc_date ? ` · ${application.cogc_date}` : ''}`} />
        </div>

        <div className="form-card">
          <h3>References</h3>
          {references.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No references were submitted.</p>
          )}
          {references.map((ref, i) => {
            const wa = waLinkTo(
              ref.phone || '',
              `Hi ${ref.full_name}, this is VacayNanny following up on a reference for ${application.full_name}.`,
              ref.country_code,
            )
            return (
              <div key={ref.id} className={i > 0 ? 'vetting-ref' : undefined}>
                <div className="review-row">
                  <span className="review-key"><strong>{ref.full_name}</strong></span>
                  <span className="review-val">{ref.relationship || 'Reference'}</span>
                </div>
                <Row label="Employer" value={ref.employer} />
                <Row label="Phone" value={[ref.country_code, ref.phone].filter(Boolean).join(' ')} />
                <Row label="Email" value={ref.email} />
                <Row label="Permission to contact" value={ref.permission_to_contact} />
                <div className="booking-actions">
                  {wa && <a className="btn-coral" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                  {ref.email && (
                    <a className="btn-ghost" href={`mailto:${ref.email}?subject=${encodeURIComponent(`VacayNanny reference — ${application.full_name}`)}`}>
                      Email
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="form-card">
          <h3>Application detail</h3>
          <Row label="Full name" value={application.full_name} />
          <Row label="Date of birth" value={application.date_of_birth} />
          <Row label="Gender" value={application.gender} />
          <Row label="Email" value={application.email} />
          <Row label="Phone" value={[application.country_code, application.phone].filter(Boolean).join(' ')} />
          <Row label="Location" value={[application.town, application.county].filter(Boolean).join(', ')} />
          <Row label="Languages" value={joinList(application.languages)} />
          <Row label="Experience" value={application.experience_years ? `${application.experience_years} year(s)` : '—'} />
          <Row label="Age groups" value={joinList(application.age_groups)} />
          <Row label="Services" value={joinList(application.services)} />
          <Row label="Certifications" value={joinList(application.certifications)} />
          <Row label="Swimming" value={application.swimming} />
          <Row label="Cooking" value={application.cooking} />
          <Row label="Tutoring" value={application.tutoring} />
          <Row label="Driving" value={application.driving} />
          <Row label="Special needs" value={application.special_needs} />
          <Row label="Available days" value={joinList(application.available_days)} />
          <Row label="Hours" value={[application.earliest_start, application.latest_end].filter(Boolean).join(' – ')} />
          <Row label="Travel" value={travelLabel(application.willing_to_travel)} />
          <Row label="Preferred locations" value={joinList(application.preferred_locations)} />
          <Row label="Pets" value={application.comfortable_pets} />
          <Row label="Multiple children" value={application.comfortable_multiple} />
          {application.bio && (
            <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginTop: 16 }}>{application.bio}</p>
          )}
        </div>
      </div>

      <aside>
        <div className="form-card">
          <h3>Decision</h3>
          <div className="review-row">
            <span className="review-key">Status</span>
            <span className="review-val">{application.status}</span>
          </div>
          <Row label="Estimated tier" value={application.estimated_tier} />
          <Row label="Submitted" value={application.created_at.slice(0, 10)} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {APP_STATUSES.map(s => (
              <button
                key={s}
                className="btn-ghost"
                style={{ padding: '8px 14px', fontSize: '0.78rem', opacity: application.status === s ? 1 : 0.6 }}
                disabled={busy === s}
                onClick={() => patch({ status: s }, s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="form-card">
          <h3>Interview</h3>
          {application.interview_at && (
            <p className="info-note" style={{ marginBottom: 14 }}>
              Scheduled for {formatNairobiInterview(application.interview_at)} EAT
            </p>
          )}
          <div className="field">
            <label htmlFor="interview-at">Date & time (EAT)</label>
            <input
              id="interview-at"
              type="datetime-local"
              value={interviewAt}
              onChange={e => setInterviewAt(e.target.value)}
            />
          </div>
          <div className="booking-actions">
            <button
              className="btn-coral"
              disabled={busy === 'interview' || !interviewAt}
              onClick={() => patch({ interviewAt, notifyInterview: true, adminNotes: notes }, 'interview')}
            >
              {busy === 'interview' ? 'Scheduling…' : 'Schedule & email'}
            </button>
            <button
              className="btn-ghost"
              disabled={busy === 'interview-save' || !interviewAt}
              onClick={() => patch({ interviewAt, adminNotes: notes }, 'interview-save')}
            >
              Save time only
            </button>
          </div>
        </div>

        <div className="form-card">
          <h3>Internal notes</h3>
          <div className="field">
            <label htmlFor="admin-notes">Visible to admin; included on reject / interview emails if filled</label>
            <textarea
              id="admin-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ minHeight: 140 }}
            />
          </div>
          <button
            className="btn-coral"
            style={{ marginTop: 12, padding: '8px 16px', fontSize: '0.82rem' }}
            disabled={busy === 'notes'}
            onClick={() => patch({ adminNotes: notes }, 'notes')}
          >
            {busy === 'notes' ? 'Saving…' : 'Save notes'}
          </button>
        </div>

        {(application.consent_background || application.consent_terms || application.consent_accuracy) && (
          <div className="form-card">
            <h3>Consents</h3>
            <Row label="Background check" value={application.consent_background ? 'Yes' : '—'} />
            <Row label="Terms" value={application.consent_terms ? 'Yes' : '—'} />
            <Row label="Accuracy" value={application.consent_accuracy ? 'Yes' : '—'} />
          </div>
        )}
      </aside>

      {preview && (
        <div className="vetting-lightbox" onClick={() => setPreview(null)} role="presentation">
          <img
            src={fileHref(application.id, preview.id)}
            alt={documentKindLabel(preview.kind)}
            onClick={e => e.stopPropagation()}
          />
          <p>{documentKindLabel(preview.kind)}</p>
        </div>
      )}
    </div>
  )
}
