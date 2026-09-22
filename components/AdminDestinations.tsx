'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Destination } from '@/lib/types'

const EMPTY = {
  name: '',
  country: 'Kenya',
  slug: '',
  image_url: '',
  description: '',
  is_active: true,
  sort_order: 0,
}

function formFrom(d: Destination) {
  return {
    name: d.name,
    country: d.country,
    slug: d.slug,
    image_url: d.image_url || '',
    description: d.description || '',
    is_active: d.is_active,
    sort_order: d.sort_order,
  }
}

export default function AdminDestinations({ destinations }: { destinations: Destination[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState(EMPTY)
  const [edits, setEdits] = useState<Record<string, ReturnType<typeof formFrom>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  function edit(id: string) {
    if (edits[id]) return edits[id]
    const row = destinations.find(d => d.id === id)
    return row ? formFrom(row) : { ...EMPTY }
  }

  function patchEdit(id: string, field: string, value: string | boolean | number) {
    setEdits(e => ({ ...e, [id]: { ...edit(id), [field]: value } }))
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy('new')
    setError('')
    try {
      const res = await fetch('/api/admin/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not add this destination.')
        return
      }
      setDraft({ ...EMPTY, sort_order: destinations.length + 1 })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function save(id: string) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/destinations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit(id)),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not save this destination.')
        return
      }
      setEdits(e => {
        const next = { ...e }
        delete next[id]
        return next
      })
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  async function hide(id: string) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/destinations/${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not hide this destination.')
        return
      }
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      {error && <p className="field-error-msg" style={{ marginBottom: 16 }}>{error}</p>}
      <form className="form-card" onSubmit={create}>
        <h3>Add destination</h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: '8px 0 16px' }}>
          Live destinations appear on the homepage, booking form, nanny search, and apply flow. Hidden ones stay off public lists.
        </p>
        <div className="mrow">
          <div className="field">
            <label htmlFor="dest-new-name">Name</label>
            <input id="dest-new-name" required value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="dest-new-country">Country</label>
            <input id="dest-new-country" required value={draft.country} onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} />
          </div>
        </div>
        <div className="mrow">
          <div className="field">
            <label htmlFor="dest-new-image">Image URL</label>
            <input id="dest-new-image" value={draft.image_url} onChange={e => setDraft(d => ({ ...d, image_url: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="field">
            <label htmlFor="dest-new-sort">Sort order</label>
            <input id="dest-new-sort" type="number" value={draft.sort_order} onChange={e => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))} />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="dest-new-desc">Description</label>
          <textarea id="dest-new-desc" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
        </div>
        <label className="force-assign">
          <input type="checkbox" checked={draft.is_active} onChange={e => setDraft(d => ({ ...d, is_active: e.target.checked }))} />
          Show on the public site
        </label>
        <button className="btn-coral" type="submit" disabled={busy === 'new'} style={{ marginTop: 12 }}>
          {busy === 'new' ? 'Adding…' : 'Add destination'}
        </button>
      </form>

      {destinations.length === 0 && (
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>No destinations in the database yet.</p>
      )}
      {destinations.map(d => {
        const form = edit(d.id)
        return (
          <form className="form-card" key={d.id} onSubmit={e => { e.preventDefault(); save(d.id) }}>
            <div className="review-row">
              <span className="review-key"><strong>{d.name}</strong><br /><small>{d.country} · {d.slug}</small></span>
              <span className="review-val">{d.is_active ? 'Live' : 'Hidden'}</span>
            </div>
            {form.image_url && (
              <img src={form.image_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 12, margin: '12px 0' }} />
            )}
            <div className="mrow">
              <div className="field">
                <label>Name</label>
                <input required value={form.name} onChange={e => patchEdit(d.id, 'name', e.target.value)} />
              </div>
              <div className="field">
                <label>Country</label>
                <input required value={form.country} onChange={e => patchEdit(d.id, 'country', e.target.value)} />
              </div>
            </div>
            <div className="mrow">
              <div className="field">
                <label>Slug</label>
                <input value={form.slug} onChange={e => patchEdit(d.id, 'slug', e.target.value)} />
              </div>
              <div className="field">
                <label>Sort order</label>
                <input type="number" value={form.sort_order} onChange={e => patchEdit(d.id, 'sort_order', Number(e.target.value))} />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Image URL</label>
              <input value={form.image_url} onChange={e => patchEdit(d.id, 'image_url', e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Description</label>
              <textarea value={form.description} onChange={e => patchEdit(d.id, 'description', e.target.value)} />
            </div>
            <label className="force-assign">
              <input type="checkbox" checked={form.is_active} onChange={e => patchEdit(d.id, 'is_active', e.target.checked)} />
              Show on the public site
            </label>
            <div className="booking-actions">
              <button className="btn-coral" type="submit" disabled={busy === d.id}>
                {busy === d.id ? 'Saving…' : 'Save'}
              </button>
              {d.is_active && (
                <button
                  className="btn-ghost"
                  type="button"
                  disabled={busy === d.id}
                  onClick={() => hide(d.id)}
                >
                  Hide from public lists
                </button>
              )}
            </div>
          </form>
        )
      })}
    </div>
  )
}
