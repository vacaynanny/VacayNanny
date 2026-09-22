'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DAYS_OF_WEEK, DESTINATIONS, formatKes, tierLabel } from '@/lib/constants'
import type { Nanny } from '@/lib/types'

function Chip({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className={`check-item${checked ? ' checked' : ''}`}
      aria-pressed={checked}
      onClick={onToggle}
    >
      <span className={`check-box${checked ? ' checked' : ''}`}>{checked ? '✓' : ''}</span>
      <span className="check-label">{label}</span>
    </button>
  )
}

export default function NannyProfileEditor({ nanny }: { nanny: Nanny }) {
  const router = useRouter()
  const destinationChoices = useMemo(() => {
    const extra = nanny.destinations.filter(d => !(DESTINATIONS as readonly string[]).includes(d))
    return [...DESTINATIONS, ...extra]
  }, [nanny.destinations])
  const [bio, setBio] = useState(nanny.bio || '')
  const [isActive, setIsActive] = useState(nanny.is_active)
  const [days, setDays] = useState<string[]>(nanny.available_days || [])
  const [destinations, setDestinations] = useState<string[]>(nanny.destinations || [])
  const [preview, setPreview] = useState(nanny.photo_url || '')
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function toggle(list: string[], value: string, setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter(item => item !== value) : [...list, value])
  }

  function onFile(next: File | null) {
    setFile(next)
    setRemovePhoto(false)
    if (next) setPreview(URL.createObjectURL(next))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const body = new FormData()
      body.set('bio', bio)
      body.set('isActive', isActive ? 'true' : 'false')
      body.set('availableDays', JSON.stringify(days))
      body.set('destinations', JSON.stringify(destinations))
      if (file) body.set('photo', file)
      if (removePhoto) body.set('removePhoto', 'true')
      const res = await fetch('/api/nanny/profile', { method: 'PATCH', body })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not save your profile.')
        return
      }
      setFile(null)
      setSaved(true)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <h3>Public profile</h3>
      <div className="review-row"><span className="review-key">Name</span><span className="review-val">{nanny.display_name}</span></div>
      <div className="review-row"><span className="review-key">Tier</span><span className="review-val">{tierLabel(nanny.tier)}</span></div>
      <div className="review-row"><span className="review-key">Daily rate</span><span className="review-val">{formatKes(nanny.daily_rate_kes)}</span></div>
      <p className="field-hint" style={{ margin: '12px 0 16px' }}>
        Tier and rate are set by VacayNanny. You can update your photo, bio, days, destinations, and whether families can find you.
      </p>

      <div className="profile-photo-row">
        <div className="profile-avatar">
          {preview && !removePhoto
            ? <img src={preview} alt="" />
            : <span>{nanny.display_name.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div>
          <label className="upload-box" style={{ marginBottom: 8 }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => onFile(e.target.files?.[0] || null)}
            />
            <p>{file ? file.name : 'Replace photo'}</p>
            <span>JPG, PNG or WebP · up to 4 MB</span>
          </label>
          {(preview || nanny.photo_url) && !removePhoto && (
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              onClick={() => {
                setFile(null)
                setPreview('')
                setRemovePhoto(true)
              }}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label htmlFor="nanny-bio">Bio</label>
        <textarea
          id="nanny-bio"
          maxLength={2000}
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Families read this on your public profile."
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <p className="field-label-inline">Available days</p>
        <div className="check-grid">
          {DAYS_OF_WEEK.map(day => (
            <Chip key={day} label={day} checked={days.includes(day)} onToggle={() => toggle(days, day, setDays)} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p className="field-label-inline">Destinations</p>
        <div className="check-grid">
          {destinationChoices.map(dest => (
            <Chip
              key={dest}
              label={dest}
              checked={destinations.includes(dest)}
              onToggle={() => toggle(destinations, dest, setDestinations)}
            />
          ))}
        </div>
      </div>

      <label className={`consent-item${isActive ? ' checked' : ''}`}>
        <input
          type="checkbox"
          checked={isActive}
          onChange={e => setIsActive(e.target.checked)}
          style={{ display: 'none' }}
        />
        <span className={`consent-box${isActive ? ' checked' : ''}`}>{isActive ? '✓' : ''}</span>
        <span className="consent-text">
          {isActive
            ? 'Live — families can find and book you.'
            : 'Hidden — your profile is off the public list. Assigned bookings stay in your dashboard.'}
        </span>
      </label>

      {error && <p className="field-error-msg">{error}</p>}
      {saved && <p className="field-hint" style={{ color: '#5ec9b6' }}>Saved. {isActive ? 'You are live.' : 'You are hidden from search.'}</p>}
      <button className="btn-coral" type="submit" disabled={busy} style={{ marginTop: 12 }}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
