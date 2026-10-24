'use client'

import { useState } from 'react'
import MediaImage from '@/components/MediaImage'
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
    <div className="edit-stack">
      {error && <p className="field-error-msg">{error}</p>}
      <header className="edit-head">
        <h2>Destinations</h2>
        <p>Live places show on the homepage, the booking form, nanny search, and the apply flow.</p>
      </header>
      <form className="edit-card" onSubmit={create}>
        <div className="edit-top">
          <strong>Add a destination</strong>
          <label className="edit-publish">
            <input type="checkbox" checked={draft.is_active} onChange={e => setDraft(d => ({ ...d, is_active: e.target.checked }))} />
            Show publicly
          </label>
        </div>
        <div className="edit-fields">
          <label className="edit-field">
            <span>Name</span>
            <input id="dest-new-name" required value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          </label>
          <label className="edit-field">
            <span>Country</span>
            <input id="dest-new-country" required value={draft.country} onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} />
          </label>
          <label className="edit-field">
            <span>Image URL</span>
            <input id="dest-new-image" value={draft.image_url} onChange={e => setDraft(d => ({ ...d, image_url: e.target.value }))} placeholder="https://…" />
          </label>
          <label className="edit-field">
            <span>Order</span>
            <input id="dest-new-sort" type="number" value={draft.sort_order} onChange={e => setDraft(d => ({ ...d, sort_order: Number(e.target.value) }))} />
          </label>
          <label className="edit-field is-wide">
            <span>Description</span>
            <textarea id="dest-new-desc" rows={4} value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
          </label>
        </div>
        <button className="btn-coral" type="submit" disabled={busy === 'new'}>
          {busy === 'new' ? 'Adding…' : 'Add destination'}
        </button>
      </form>

      {destinations.length === 0 && (
        <div className="ops-empty">
          <h3>No destinations yet</h3>
          <p>Add the first place above. It stays off the public site until “Show publicly” is checked.</p>
        </div>
      )}
      {destinations.length > 0 && (
        <div className="edit-grid">
          {destinations.map(d => {
            const form = edit(d.id)
            return (
              <form className="edit-card" key={d.id} onSubmit={e => { e.preventDefault(); save(d.id) }}>
                <div className="edit-top">
                  <div>
                    <p className="edit-kicker">{form.country || 'Destination'}</p>
                    <strong>{form.name || d.name}</strong>
                  </div>
                  <span className={`ops-pill${d.is_active ? ' is-live' : ''}`}>{d.is_active ? 'Live' : 'Hidden'}</span>
                </div>
                {form.image_url && (
                  <div className="dest-preview">
                    <MediaImage src={form.image_url} alt="" fill sizes="420px" style={{ objectFit: 'cover' }} />
                  </div>
                )}
                <div className="edit-fields">
                  <label className="edit-field">
                    <span>Name</span>
                    <input required value={form.name} onChange={e => patchEdit(d.id, 'name', e.target.value)} />
                  </label>
                  <label className="edit-field">
                    <span>Country</span>
                    <input required value={form.country} onChange={e => patchEdit(d.id, 'country', e.target.value)} />
                  </label>
                  <label className="edit-field">
                    <span>Slug</span>
                    <input value={form.slug} onChange={e => patchEdit(d.id, 'slug', e.target.value)} />
                  </label>
                  <label className="edit-field">
                    <span>Order</span>
                    <input type="number" value={form.sort_order} onChange={e => patchEdit(d.id, 'sort_order', Number(e.target.value))} />
                  </label>
                  <label className="edit-field is-wide">
                    <span>Image URL</span>
                    <input value={form.image_url} onChange={e => patchEdit(d.id, 'image_url', e.target.value)} />
                  </label>
                  <label className="edit-field is-wide">
                    <span>Description</span>
                    <textarea rows={4} value={form.description} onChange={e => patchEdit(d.id, 'description', e.target.value)} />
                  </label>
                </div>
                <label className="edit-publish">
                  <input type="checkbox" checked={form.is_active} onChange={e => patchEdit(d.id, 'is_active', e.target.checked)} />
                  Show publicly
                </label>
                <div className="ops-card-actions">
                  <button className="btn-coral" type="submit" disabled={busy === d.id}>
                    {busy === d.id ? 'Saving…' : 'Save'}
                  </button>
                  {d.is_active && (
                    <button className="btn-ghost" type="button" disabled={busy === d.id} onClick={() => hide(d.id)}>
                      Hide
                    </button>
                  )}
                </div>
              </form>
            )
          })}
        </div>
      )}
    </div>
  )
}
