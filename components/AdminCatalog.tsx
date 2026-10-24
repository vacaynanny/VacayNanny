'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BusinessPolicies, CareOffering, FaqEntry, HomepageStep, PricingAddon, PricingTier, SiteCatalog } from '@/lib/catalog'

const EMPTY_ADDON = { name: '', description: '', amountKes: '', pricingMode: 'flat', sortOrder: 1 }
const EMPTY_FAQ = { question: '', answer: '', sortOrder: 1 }
const EMPTY_STEP = { stepLabel: '', title: '', imageUrl: '', imageAlt: '', sortOrder: 1 }

async function send(method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, query = '') {
  const res = await fetch(`/api/admin/catalog${query}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Could not save.')
}

function Active({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="force-assign" style={{ marginTop: 8 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      Published
    </label>
  )
}

export default function AdminCatalog({
  section,
  catalog,
}: {
  section: 'pricing' | 'content'
  catalog: SiteCatalog | null
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [tiers, setTiers] = useState<Record<string, PricingTier>>({})
  const [care, setCare] = useState<Record<string, CareOffering>>({})
  const [addons, setAddons] = useState<Record<string, PricingAddon>>({})
  const [faqs, setFaqs] = useState<Record<string, FaqEntry>>({})
  const [steps, setSteps] = useState<Record<string, HomepageStep>>({})
  const [policy, setPolicy] = useState<BusinessPolicies | null>(catalog?.policies || null)
  const [addonDraft, setAddonDraft] = useState(EMPTY_ADDON)
  const [faqDraft, setFaqDraft] = useState(EMPTY_FAQ)
  const [stepDraft, setStepDraft] = useState(EMPTY_STEP)

  async function run(id: string, work: () => Promise<void>) {
    setBusy(id)
    setError('')
    try {
      await work()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  if (!catalog || !policy) {
    return (
      <div className="form-card">
        <h3>Catalog not in the database yet</h3>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
          Run supabase/content_catalog.sql in the Supabase SQL editor. Until those tables exist, the public site keeps the built-in demo copy and this screen cannot save changes.
        </p>
      </div>
    )
  }

  const tierRow = (row: PricingTier) => tiers[row.code] || row
  const careRow = (row: CareOffering) => care[row.code] || row
  const addonRow = (row: PricingAddon) => addons[row.id] || row
  const faqRow = (row: FaqEntry) => faqs[row.id] || row
  const stepRow = (row: HomepageStep) => steps[row.id] || row

  return (
    <div>
      {error && <p style={{ color: '#ff8a8a', marginBottom: 12 }}>{error}</p>}
      {section === 'pricing' && (
        <div>
          <h3 style={{ marginBottom: 12 }}>Tier rates and features</h3>
          {catalog.tiers.map(original => {
            const row = tierRow(original)
            return (
              <form className="form-card" key={row.code} onSubmit={e => {
                e.preventDefault()
                run(row.code, async () => {
                  await send('PATCH', { kind: 'tier', ...row, features: row.features })
                  setTiers(current => {
                    const next = { ...current }
                    delete next[row.code]
                    return next
                  })
                })
              }}>
                <strong>{row.code}</strong>
                <div className="mrow" style={{ marginTop: 10 }}>
                  <input value={row.cardTitle} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, cardTitle: e.target.value } }))} placeholder="Card title" />
                  <input value={row.label} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, label: e.target.value } }))} placeholder="Public label" />
                </div>
                <div className="mrow">
                  <input value={row.badge} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, badge: e.target.value } }))} placeholder="Badge" />
                  <input type="number" value={row.dailyRateKes} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, dailyRateKes: Number(e.target.value) } }))} placeholder="Daily rate KES" />
                </div>
                <input value={row.period} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, period: e.target.value } }))} placeholder="Period" />
                <textarea value={row.description} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, description: e.target.value } }))} placeholder="Description" />
                <textarea value={row.features.join('\n')} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, features: e.target.value.split('\n') } }))} placeholder="One feature per line" />
                <div className="mrow">
                  <input value={row.cta} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, cta: e.target.value } }))} placeholder="Button" />
                  <input type="number" value={row.sortOrder} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, sortOrder: Number(e.target.value) } }))} />
                </div>
                <Active checked={row.isActive} onChange={value => setTiers(s => ({ ...s, [row.code]: { ...row, isActive: value } }))} />
                <button className="btn-coral" type="submit" disabled={busy === row.code} style={{ marginTop: 12 }}>Save {row.cardTitle || row.code}</button>
              </form>
            )
          })}

          <h3 style={{ margin: '18px 0 12px' }}>Care packages</h3>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>The multiplier is what a booking charges. The homepage shows the same multiple, not a separate flat price.</p>
          {catalog.care.map(original => {
            const row = careRow(original)
            return (
              <form className="form-card" key={row.code} onSubmit={e => {
                e.preventDefault()
                run(row.code, async () => {
                  await send('PATCH', { kind: 'care', ...row })
                  setCare(current => {
                    const next = { ...current }
                    delete next[row.code]
                    return next
                  })
                })
              }}>
                <strong>{row.code}</strong>
                <input value={row.label} onChange={e => setCare(s => ({ ...s, [row.code]: { ...row, label: e.target.value } }))} placeholder="Label" />
                <div className="mrow">
                  <input type="number" value={row.hours} onChange={e => setCare(s => ({ ...s, [row.code]: { ...row, hours: Number(e.target.value) } }))} placeholder="Hours" />
                  <input type="number" step="0.1" value={row.multiplier} onChange={e => setCare(s => ({ ...s, [row.code]: { ...row, multiplier: Number(e.target.value) } }))} placeholder="Multiplier" />
                </div>
                <input value={row.hint} onChange={e => setCare(s => ({ ...s, [row.code]: { ...row, hint: e.target.value } }))} placeholder="Hint" />
                <Active checked={row.isActive} onChange={value => setCare(s => ({ ...s, [row.code]: { ...row, isActive: value } }))} />
                <button className="btn-coral" type="submit" disabled={busy === row.code} style={{ marginTop: 12 }}>Save {row.label || row.code}</button>
              </form>
            )
          })}

          <h3 style={{ margin: '18px 0 12px' }}>Optional add-ons</h3>
          {catalog.addons.map(original => {
            const row = addonRow(original)
            return (
              <form className="form-card" key={row.id} onSubmit={e => {
                e.preventDefault()
                run(row.id, async () => {
                  await send('PATCH', { kind: 'addon', ...row })
                  setAddons(current => {
                    const next = { ...current }
                    delete next[row.id]
                    return next
                  })
                })
              }}>
                <input value={row.name} onChange={e => setAddons(s => ({ ...s, [row.id]: { ...row, name: e.target.value } }))} placeholder="Name" />
                <input value={row.description} onChange={e => setAddons(s => ({ ...s, [row.id]: { ...row, description: e.target.value } }))} placeholder="Description (optional)" />
                <div className="mrow">
                  <select value={row.pricingMode} onChange={e => setAddons(s => ({ ...s, [row.id]: { ...row, pricingMode: e.target.value === 'custom' ? 'custom' : 'flat' } }))}>
                    <option value="flat">Flat amount</option>
                    <option value="custom">Custom quote</option>
                  </select>
                  <input type="number" value={row.amountKes ?? ''} disabled={row.pricingMode === 'custom'} onChange={e => setAddons(s => ({ ...s, [row.id]: { ...row, amountKes: e.target.value === '' ? null : Number(e.target.value) } }))} placeholder="KES" />
                </div>
                <Active checked={row.isActive} onChange={value => setAddons(s => ({ ...s, [row.id]: { ...row, isActive: value } }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn-coral" type="submit" disabled={busy === row.id}>Save</button>
                  <button className="btn-ghost" type="button" disabled={busy === row.id} onClick={() => run(row.id, () => send('DELETE', undefined, `?kind=addon&id=${encodeURIComponent(row.id)}`))}>Delete</button>
                </div>
              </form>
            )
          })}
          <form className="form-card" onSubmit={e => {
            e.preventDefault()
            run('new-addon', async () => {
              await send('POST', { kind: 'addon', ...addonDraft, amountKes: addonDraft.pricingMode === 'custom' ? null : addonDraft.amountKes })
              setAddonDraft(EMPTY_ADDON)
            })
          }}>
            <h3>New add-on</h3>
            <input value={addonDraft.name} onChange={e => setAddonDraft(d => ({ ...d, name: e.target.value }))} placeholder="Name" />
            <input value={addonDraft.description} onChange={e => setAddonDraft(d => ({ ...d, description: e.target.value }))} placeholder="Description (optional)" />
            <div className="mrow">
              <select value={addonDraft.pricingMode} onChange={e => setAddonDraft(d => ({ ...d, pricingMode: e.target.value }))}>
                <option value="flat">Flat amount</option>
                <option value="custom">Custom quote</option>
              </select>
              <input type="number" value={addonDraft.amountKes} disabled={addonDraft.pricingMode === 'custom'} onChange={e => setAddonDraft(d => ({ ...d, amountKes: e.target.value }))} placeholder="KES" />
            </div>
            <button className="btn-coral" type="submit" disabled={busy === 'new-addon'} style={{ marginTop: 12 }}>Add add-on</button>
          </form>
        </div>
      )}

      {section === 'content' && (
        <div>
          <form className="form-card" onSubmit={e => {
            e.preventDefault()
            run('policy', () => send('PATCH', { kind: 'policy', ...policy }))
          }}>
            <h3>Booking policies</h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', margin: '8px 0' }}>
              These numbers drive refunds, the replacement clock, and the booking quote. FAQ answers and tier features can include {'{{replacement_hours}}'}, {'{{cancel_full_hours}}'}, {'{{cancel_partial_hours}}'}, {'{{cancel_partial_percent}}'}, {'{{standard_hours}}'}, and {'{{lead_hours}}'}.
            </p>
            <label>Replacement guarantee (hours)<input type="number" value={policy.replacementSlaHours} onChange={e => setPolicy({ ...policy, replacementSlaHours: Number(e.target.value) })} /></label>
            <label>Full refund from (hours before start)<input type="number" value={policy.cancellationFullHours} onChange={e => setPolicy({ ...policy, cancellationFullHours: Number(e.target.value) })} /></label>
            <label>Partial refund from (hours)<input type="number" value={policy.cancellationPartialHours} onChange={e => setPolicy({ ...policy, cancellationPartialHours: Number(e.target.value) })} /></label>
            <label>Partial refund percent<input type="number" value={policy.cancellationPartialPercent} onChange={e => setPolicy({ ...policy, cancellationPartialPercent: Number(e.target.value) })} /></label>
            <label>Standard shift (hours)<input type="number" value={policy.standardShiftHours} onChange={e => setPolicy({ ...policy, standardShiftHours: Number(e.target.value) })} /></label>
            <label>Recommended lead time (hours)<input type="number" value={policy.recommendedLeadHours} onChange={e => setPolicy({ ...policy, recommendedLeadHours: Number(e.target.value) })} /></label>
            <label>Maximum nannies on one booking<input type="number" value={policy.maxNannies} onChange={e => setPolicy({ ...policy, maxNannies: Number(e.target.value) })} /></label>
            <button className="btn-coral" type="submit" disabled={busy === 'policy'} style={{ marginTop: 12 }}>Save policies</button>
          </form>

          <h3 style={{ margin: '18px 0 12px' }}>FAQs</h3>
          {catalog.faqs.map(original => {
            const row = faqRow(original)
            return (
              <form className="form-card" key={row.id} onSubmit={e => {
                e.preventDefault()
                run(row.id, async () => {
                  await send('PATCH', { kind: 'faq', ...row })
                  setFaqs(current => {
                    const next = { ...current }
                    delete next[row.id]
                    return next
                  })
                })
              }}>
                <input value={row.question} onChange={e => setFaqs(s => ({ ...s, [row.id]: { ...row, question: e.target.value } }))} />
                <textarea value={row.answer} onChange={e => setFaqs(s => ({ ...s, [row.id]: { ...row, answer: e.target.value } }))} />
                <input type="number" value={row.sortOrder} onChange={e => setFaqs(s => ({ ...s, [row.id]: { ...row, sortOrder: Number(e.target.value) } }))} />
                <Active checked={row.isActive} onChange={value => setFaqs(s => ({ ...s, [row.id]: { ...row, isActive: value } }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn-coral" type="submit" disabled={busy === row.id}>Save</button>
                  <button className="btn-ghost" type="button" disabled={busy === row.id} onClick={() => run(row.id, () => send('DELETE', undefined, `?kind=faq&id=${encodeURIComponent(row.id)}`))}>Delete</button>
                </div>
              </form>
            )
          })}
          <form className="form-card" onSubmit={e => {
            e.preventDefault()
            run('new-faq', async () => {
              await send('POST', { kind: 'faq', ...faqDraft })
              setFaqDraft(EMPTY_FAQ)
            })
          }}>
            <h3>New question</h3>
            <input value={faqDraft.question} onChange={e => setFaqDraft(d => ({ ...d, question: e.target.value }))} placeholder="Question" />
            <textarea value={faqDraft.answer} onChange={e => setFaqDraft(d => ({ ...d, answer: e.target.value }))} placeholder="Answer" />
            <button className="btn-coral" type="submit" disabled={busy === 'new-faq'} style={{ marginTop: 12 }}>Add question</button>
          </form>

          <h3 style={{ margin: '18px 0 12px' }}>How it works</h3>
          {catalog.steps.map(original => {
            const row = stepRow(original)
            return (
              <form className="form-card" key={row.id} onSubmit={e => {
                e.preventDefault()
                run(row.id, async () => {
                  await send('PATCH', { kind: 'step', ...row })
                  setSteps(current => {
                    const next = { ...current }
                    delete next[row.id]
                    return next
                  })
                })
              }}>
                <div className="mrow">
                  <input value={row.stepLabel} onChange={e => setSteps(s => ({ ...s, [row.id]: { ...row, stepLabel: e.target.value } }))} placeholder="Step label" />
                  <input value={row.title} onChange={e => setSteps(s => ({ ...s, [row.id]: { ...row, title: e.target.value } }))} placeholder="Title" />
                </div>
                <input value={row.imageUrl} onChange={e => setSteps(s => ({ ...s, [row.id]: { ...row, imageUrl: e.target.value } }))} placeholder="Image URL" />
                <input value={row.imageAlt} onChange={e => setSteps(s => ({ ...s, [row.id]: { ...row, imageAlt: e.target.value } }))} placeholder="Image description" />
                <Active checked={row.isActive} onChange={value => setSteps(s => ({ ...s, [row.id]: { ...row, isActive: value } }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn-coral" type="submit" disabled={busy === row.id}>Save</button>
                  <button className="btn-ghost" type="button" disabled={busy === row.id} onClick={() => run(row.id, () => send('DELETE', undefined, `?kind=step&id=${encodeURIComponent(row.id)}`))}>Delete</button>
                </div>
              </form>
            )
          })}
          <form className="form-card" onSubmit={e => {
            e.preventDefault()
            run('new-step', async () => {
              await send('POST', { kind: 'step', ...stepDraft })
              setStepDraft(EMPTY_STEP)
            })
          }}>
            <h3>New step</h3>
            <div className="mrow">
              <input value={stepDraft.stepLabel} onChange={e => setStepDraft(d => ({ ...d, stepLabel: e.target.value }))} placeholder="Step 5" />
              <input value={stepDraft.title} onChange={e => setStepDraft(d => ({ ...d, title: e.target.value }))} placeholder="Title" />
            </div>
            <input value={stepDraft.imageUrl} onChange={e => setStepDraft(d => ({ ...d, imageUrl: e.target.value }))} placeholder="Image URL" />
            <input value={stepDraft.imageAlt} onChange={e => setStepDraft(d => ({ ...d, imageAlt: e.target.value }))} placeholder="Image description" />
            <button className="btn-coral" type="submit" disabled={busy === 'new-step'} style={{ marginTop: 12 }}>Add step</button>
          </form>
        </div>
      )}
    </div>
  )
}
