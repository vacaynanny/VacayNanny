'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BookingReviewForm({
  bookingId,
  nannyName,
}: {
  bookingId: string
  nannyName?: string
}) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const shown = hover || rating

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, rating, body }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not save your review.')
        return
      }
      setBody('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="review-form" onSubmit={submit}>
      <p className="review-form-title">How was care{nannyName ? ` with ${nannyName}` : ''}?</p>
      <div className="star-picker" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            className={star <= shown ? 'on' : ''}
            onMouseEnter={() => setHover(star)}
            onClick={() => setRating(star)}
          >
            ★
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor={`review-body-${bookingId}`}>Your review</label>
        <textarea
          id={`review-body-${bookingId}`}
          required
          minLength={10}
          maxLength={2000}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="What went well? Anything the next family should know?"
        />
      </div>
      {error && <p className="field-error-msg">{error}</p>}
      <button className="btn-coral" type="submit" disabled={busy || rating < 1}>
        {busy ? 'Saving…' : 'Submit review'}
      </button>
    </form>
  )
}
