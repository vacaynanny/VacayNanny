'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function ClaimApplication() {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  async function claim() {
    setBusy(true)
    try {
      const response = await fetch('/api/account/claim-application', { method: 'POST' })
      const data = await response.json()
      setMessage(
        response.ok
          ? data.linked
            ? 'Your application is linked.'
            : 'No application was found for your verified email.'
          : data.error,
      )
      if (response.ok && data.linked) router.refresh()
    } catch {
      setMessage('Could not link your application. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="form-card">
      <h3>Already applied?</h3>
      <p>
        Use your verified application email to connect an application submitted before
        registration.
      </p>
      <button className="btn-ghost" disabled={busy} onClick={claim}>
        {busy ? 'Linking…' : 'Link my application'}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  )
}
