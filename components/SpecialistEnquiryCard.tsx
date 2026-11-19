'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CareEnquiry } from '@/lib/care-enquiries'
export default function SpecialistEnquiryCard({
  enquiry,
  adminId,
  operators = [],
}: {
  enquiry: CareEnquiry
  operators?: Array<{ id: string; fullName: string; email: string | null }>
  adminId: string
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function save(form: HTMLFormElement, status: string) {
    setBusy(true)
    setError('')
    const data = new FormData(form)
    const changes: Record<string, unknown> = {
      version: enquiry.quote_version || 0,
      care_status: status,
    }
    if (!['accepted', 'fulfilled', 'closed'].includes(enquiry.care_status || '')) {
      for (const name of [
        'assessment_notes',
        'provider_details',
        'quote_summary',
        'service_start',
        'service_end',
      ])
        changes[name] = data.get(name) || null
      changes.assigned_to = String(
        data.get('assigned_to') || enquiry.assigned_to || adminId,
      )
      changes.quote_amount_kes = data.get('quote_amount_kes')
        ? Number(data.get('quote_amount_kes'))
        : null
      const expiry = String(data.get('quote_expires_at') || '')
      changes.quote_expires_at = expiry
        ? new Date(`${expiry}T23:59:59+03:00`).toISOString()
        : null
    }
    try {
      const response = await fetch(`/api/admin/care-enquiries/${enquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      const result = await response.json()
      if (!response.ok) setError(result.error)
      else router.refresh()
    } catch {
      setError('Could not save the enquiry. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  const locked = ['accepted', 'fulfilled', 'closed'].includes(enquiry.care_status || '')
  return (
    <form
      className="form-card specialist-enquiry"
      onSubmit={(event) => {
        event.preventDefault()
        void save(event.currentTarget, 'assessing')
      }}
    >
      <p className="eyebrow">{enquiry.care_service}</p>
      <h3>{enquiry.name}</h3>
      <p>
        {enquiry.email} · {enquiry.care_status || 'new'}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{enquiry.message}</p>
      <p>
        {enquiry.assigned_to
          ? 'Assigned to an operator'
          : 'Unassigned — saving the assessment assigns it to you'}
      </p>
      <fieldset disabled={busy || locked} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <label className="field">
          Assigned operator
          <select name="assigned_to" defaultValue={enquiry.assigned_to || adminId}>
            {operators.length ? (
              operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.fullName || operator.email || 'Operations team member'}
                </option>
              ))
            ) : (
              <option value={adminId}>Current operator</option>
            )}
          </select>
        </label>
        <label className="field">
          Private assessment notes
          <textarea
            name="assessment_notes"
            defaultValue={enquiry.assessment_notes || ''}
            maxLength={5000}
          />
        </label>
        <label className="field">
          Provider qualifications and verification reference
          <textarea
            name="provider_details"
            defaultValue={enquiry.provider_details || ''}
            maxLength={2000}
          />
        </label>
        <label className="field">
          Care plan and quote scope shown to the family
          <textarea
            name="quote_summary"
            defaultValue={enquiry.quote_summary || ''}
            maxLength={5000}
          />
        </label>
        <div className="field-row">
          <label className="field">
            Service starts
            <input
              name="service_start"
              type="date"
              defaultValue={enquiry.service_start || ''}
            />
          </label>
          <label className="field">
            Service ends
            <input
              name="service_end"
              type="date"
              defaultValue={enquiry.service_end || ''}
            />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            Total quote (KES)
            <input
              name="quote_amount_kes"
              type="number"
              min="1"
              max="10000000"
              defaultValue={enquiry.quote_amount_kes || ''}
            />
          </label>
          <label className="field">
            Quote valid through (EAT)
            <input
              name="quote_expires_at"
              type="date"
              defaultValue={enquiry.quote_expires_at?.slice(0, 10) || ''}
            />
          </label>
        </div>
        <div className="booking-actions">
          <button className="btn-ghost" type="submit">
            Save assessment
          </button>
          <button
            className="btn-coral"
            type="button"
            onClick={(e) => {
              if (e.currentTarget.form) void save(e.currentTarget.form, 'quoted')
            }}
          >
            Publish and send quote
          </button>
        </div>
      </fieldset>
      {enquiry.care_status === 'accepted' && (
        <button
          type="button"
          className="btn-coral"
          disabled={busy}
          onClick={(e) => {
            if (e.currentTarget.form) void save(e.currentTarget.form, 'fulfilled')
          }}
        >
          Mark care fulfilled
        </button>
      )}
      {enquiry.care_status !== 'closed' && (
        <button
          type="button"
          className="btn-ghost"
          disabled={busy}
          onClick={(e) => {
            if (e.currentTarget.form) void save(e.currentTarget.form, 'closed')
          }}
        >
          Close enquiry
        </button>
      )}
      {error && (
        <p className="field-error-msg" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
