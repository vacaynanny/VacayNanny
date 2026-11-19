'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { FamilyCareEnquiry } from '@/lib/care-enquiries'
import { formatKes } from '@/lib/constants'
export default function CareEnquiryView({
  enquiry,
  token,
}: {
  enquiry: FamilyCareEnquiry
  token?: string
}) {
  const [now] = useState(() => Date.now())
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function accept() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/care-enquiries/${enquiry.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: 'accept', version: enquiry.quote_version }),
      })
      const data = await response.json()
      if (!response.ok) setError(data.error)
      else router.refresh()
    } catch {
      setError('Could not accept the quote. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  const quoted = enquiry.care_status === 'quoted',
    expired = quoted && Date.parse(enquiry.quote_expires_at || '') <= now
  return (
    <article className="form-card care-enquiry">
      <p className="eyebrow">Specialist care</p>
      <h2>{enquiry.care_service}</h2>
      <p>
        Status: <strong>{enquiry.care_status}</strong>
      </p>
      {enquiry.quote_summary && (
        <>
          <h3>Your care plan</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{enquiry.quote_summary}</p>
          <p>
            {enquiry.service_start} to {enquiry.service_end}
          </p>
          <p>
            Total quote: <strong>{formatKes(enquiry.quote_amount_kes || 0)}</strong>
          </p>
          <p>
            Valid until{' '}
            {new Date(enquiry.quote_expires_at || '').toLocaleString('en-KE', {
              timeZone: 'Africa/Nairobi',
            })}{' '}
            EAT
          </p>
        </>
      )}
      {quoted && !expired && (
        <button className="btn-coral" disabled={busy} onClick={accept}>
          {busy ? 'Accepting…' : 'Accept this care quote'}
        </button>
      )}
      {expired && <p>This quote has expired. Contact our team for an updated quote.</p>}
      {enquiry.care_status === 'accepted' && (
        <p>
          Your quote is accepted. Your assigned operator will confirm the care
          arrangements with you.
        </p>
      )}
      {['new', 'assessing'].includes(enquiry.care_status || '') && (
        <p>
          Our team is reviewing your needs. Your quote and care plan will appear here when
          ready.
        </p>
      )}
      {error && (
        <p role="alert" className="field-error-msg">
          {error}
        </p>
      )}
    </article>
  )
}
