'use client'

import { useState } from 'react'
import MediaImage from '@/components/MediaImage'
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

  const shown = preview && !removeAvatar
  const initials = (() => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'YN'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  })()

  return (
    <form className="account-panel" onSubmit={submit}>
      <div className="account-section-head">
        <h2>Your details</h2>
        <p>Name and phone are filled in on the next booking request. Email stays on your login.</p>
      </div>
      <div className="account-photo">
        <div className="account-avatar">
          {shown
            ? <MediaImage className="account-avatar-img" src={preview} alt="" fill sizes="84px" />
            : <span>{initials}</span>}
        </div>
        <div className="account-photo-actions">
          <label className="account-upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={e => onFile(e.target.files?.[0] || null)}
            />
            {file ? file.name : 'Change photo'}
          </label>
          {(preview || profile.avatar_url) && !removeAvatar && (
            <button
              type="button"
              className="account-text-btn"
              onClick={() => {
                setFile(null)
                setPreview('')
                setRemoveAvatar(true)
              }}
            >
              Remove
            </button>
          )}
          <p>JPG, PNG or WebP · up to 4 MB</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="account-email">Email</label>
        <input id="account-email" value={profile.email || ''} readOnly />
      </div>
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
      {error && <p className="field-error-msg">{error}</p>}
      {saved && <p className="account-saved">Saved. Future requests will use these details.</p>}
      <button className="btn-coral account-save" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}
