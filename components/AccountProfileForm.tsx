'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'

export default function AccountProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [fullName, setFullName] = useState(profile.full_name || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [preview, setPreview] = useState(profile.avatar_url || '')
  const [file, setFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function onFile(next: File | null) {
    setFile(next)
    setRemoveAvatar(false)
    if (next) setPreview(URL.createObjectURL(next))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const body = new FormData()
      body.set('fullName', fullName)
      body.set('phone', phone)
      if (file) body.set('avatar', file)
      if (removeAvatar) body.set('removeAvatar', 'true')
      const res = await fetch('/api/account/profile', { method: 'PATCH', body })
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
      <h3>Your details</h3>
      <p className="field-hint" style={{ marginBottom: 16 }}>
        These fill booking requests automatically. Email stays {profile.email || 'on your login'}.
      </p>
      <div className="profile-photo-row">
        <div className="profile-avatar">
          {preview && !removeAvatar
            ? <img src={preview} alt="" />
            : <span>{(fullName || 'YN').slice(0, 2).toUpperCase()}</span>}
        </div>
        <div>
          <label className="upload-box" style={{ marginBottom: 8 }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => onFile(e.target.files?.[0] || null)}
            />
            <p>{file ? file.name : 'Upload a photo'}</p>
            <span>JPG, PNG or WebP · up to 4 MB</span>
          </label>
          {(preview || profile.avatar_url) && !removeAvatar && (
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              onClick={() => {
                setFile(null)
                setPreview('')
                setRemoveAvatar(true)
              }}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="account-name">Full name</label>
          <input
            id="account-name"
            required
            minLength={2}
            maxLength={80}
            value={fullName}
            onChange={e => setFullName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="account-phone">Phone</label>
          <input
            id="account-phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+254 7xx xxx xxx"
          />
        </div>
      </div>
      {error && <p className="field-error-msg">{error}</p>}
      {saved && <p className="field-hint" style={{ color: '#5ec9b6' }}>Saved.</p>}
      <button className="btn-coral" type="submit" disabled={busy} style={{ marginTop: 8 }}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
