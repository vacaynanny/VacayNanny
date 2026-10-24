'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['parent', 'nanny', 'admin']

function roleLabel(role: UserRole) {
  switch (role) {
    case 'parent':
      return 'Family'
    case 'nanny':
      return 'Nanny'
    case 'admin':
      return 'Admin'
    default: {
      const _never: never = role
      return _never
    }
  }
}

export default function AdminTeam({ people, adminId }: { people: Profile[]; adminId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function setRole(id: string, role: UserRole) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch('/api/admin/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not change this role.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  if (people.length === 0) {
    return (
      <div className="ops-empty">
        <h3>No profiles yet</h3>
        <p>A profile row is created when someone signs up after the database schema is in place. Logins without a profile stay on the family account.</p>
      </div>
    )
  }

  return (
    <div className="ops-stack">
      <p className="ops-note">Roles decide which desk someone opens. Keep at least one admin.</p>
      {error && <p className="field-error-msg">{error}</p>}
      {people.map(person => (
        <article className="ops-card" key={person.id}>
          <header className="ops-card-head">
            <div>
              <h3>{person.full_name || 'Unnamed account'}{person.id === adminId ? ' · You' : ''}</h3>
              <p>{person.email || 'No email'}{person.phone ? ` · ${person.phone}` : ''}</p>
            </div>
            <span className={`ops-pill${person.role === 'admin' ? ' is-live' : ''}`}>{roleLabel(person.role)}</span>
          </header>
          <label className="ops-status-field">
            <span>Role</span>
            <select
              aria-label={`Role for ${person.full_name || person.email || 'account'}`}
              value={person.role}
              disabled={busy === person.id}
              onChange={e => {
                const next = e.target.value
                if (next === 'parent' || next === 'nanny' || next === 'admin') setRole(person.id, next)
              }}
            >
              {ROLES.map(role => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </select>
          </label>
        </article>
      ))}
    </div>
  )
}
