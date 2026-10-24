'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RegisteredAccount, UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['parent', 'nanny', 'admin']
const FILTERS: Array<{ id: UserRole | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'parent', label: 'Families' },
  { id: 'nanny', label: 'Nannies' },
  { id: 'admin', label: 'Admins' },
]

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

function when(iso: string | null) {
  if (!iso) return 'Never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminTeam({ accounts, adminId }: { accounts: RegisteredAccount[]; adminId: string }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts.filter(account => {
      if (roleFilter !== 'all' && account.role !== roleFilter) return false
      if (!q) return true
      return [account.fullName, account.email, account.phone].some(part => (part || '').toLowerCase().includes(q))
    })
  }, [accounts, query, roleFilter])

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

  if (accounts.length === 0) {
    return (
      <div className="ops-empty">
        <h3>No registered accounts</h3>
        <p>People who create a login show up here with the date they registered and the last time they signed in.</p>
      </div>
    )
  }

  return (
    <div className="ops-stack">
      <p className="ops-note">Every login, including people who registered before profiles existed. Family and nanny come from the account role.</p>
      <div className="ops-filter-pills" role="tablist" aria-label="Account type">
        {FILTERS.map(filter => {
          const count = filter.id === 'all'
            ? accounts.length
            : accounts.filter(account => account.role === filter.id).length
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={roleFilter === filter.id}
              className={roleFilter === filter.id ? 'active' : ''}
              onClick={() => setRoleFilter(filter.id)}
            >
              {filter.label} ({count})
            </button>
          )
        })}
      </div>
      <input
        className="ops-search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search name or email"
        aria-label="Search accounts"
      />
      {error && <p className="field-error-msg">{error}</p>}
      {shown.length === 0 && <p className="ops-note">No accounts match that search.</p>}
      {shown.map(account => (
        <article className="ops-card" key={account.id}>
          <header className="ops-card-head">
            <div>
              <h3>{account.fullName || 'Unnamed account'}{account.id === adminId ? ' · You' : ''}</h3>
              <p>{account.email || 'No email'}{account.phone ? ` · ${account.phone}` : ''}</p>
            </div>
            <span className={`ops-pill${account.role === 'admin' ? ' is-live' : ''}`}>{roleLabel(account.role)}</span>
          </header>
          <p className="ops-meta">Registered {when(account.registeredAt)}</p>
          <p className="ops-meta">Last login {when(account.lastSignInAt)}</p>
          {!account.hasProfile && <p className="ops-note">No saved profile yet. Choosing a role here creates one.</p>}
          <label className="ops-status-field">
            <span>Role</span>
            <select
              aria-label={`Role for ${account.fullName || account.email || 'account'}`}
              value={account.role}
              disabled={busy === account.id}
              onChange={e => {
                const next = e.target.value
                if (next === 'parent' || next === 'nanny' || next === 'admin') setRole(account.id, next)
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
