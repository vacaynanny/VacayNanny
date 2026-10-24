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
    <label className="edit-publish">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      Published
    </label>
  )
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string
  hint?: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`edit-field${wide ? ' is-wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
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
        <div className="edit-stack">
          <header className="edit-head">
            <h2>Tier rates and features</h2>
            <p>These cards are what families see on the homepage. The daily rate is also the rate used when a booking has no named nanny.</p>
          </header>
          <div className="edit-grid">
          {catalog.tiers.map(original => {
            const row = tierRow(original)
            return (
              <form className="edit-card" key={row.code} onSubmit={e => {
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
                <div className="edit-top">
                  <div>
                    <p className="edit-kicker">{row.code}</p>
                    <strong>{row.cardTitle || row.code}</strong>
                  </div>
                  <Active checked={row.isActive} onChange={value => setTiers(s => ({ ...s, [row.code]: { ...row, isActive: value } }))} />
                </div>
                <div className="edit-fields">
                  <Field label="Card title">
                    <input value={row.cardTitle} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, cardTitle: e.target.value } }))} />
                  </Field>
                  <Field label="Menu label" hint="Shown in booking dropdowns.">
                    <input value={row.label} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, label: e.target.value } }))} />
                  </Field>
                  <Field label="Badge">
                    <input value={row.badge} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, badge: e.target.value } }))} />
                  </Field>
                  <Field label="Daily rate (KES)">
                    <input type="number" min={0} value={row.dailyRateKes} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, dailyRateKes: Number(e.target.value) } }))} />
                  </Field>
                  <Field wide label="Rate line" hint="Use {{standard_hours}} for the live shift length.">
                    <input value={row.period} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, period: e.target.value } }))} />
                  </Field>
                  <Field wide label="Description">
                    <textarea value={row.description} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, description: e.target.value } }))} />
                  </Field>
                  <Field wide label="Features" hint="One per line. {{replacement_hours}} fills in the guarantee.">
                    <textarea rows={8} value={row.features.join('\n')} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, features: e.target.value.split('\n') } }))} />
                  </Field>
                  <Field label="Button">
                    <input value={row.cta} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, cta: e.target.value } }))} />
                  </Field>
                  <Field label="Order">
                    <input type="number" value={row.sortOrder} onChange={e => setTiers(s => ({ ...s, [row.code]: { ...row, sortOrder: Number(e.target.value) } }))} />
                  </Field>
                </div>
                <button className="btn-coral" type="submit" disabled={busy === row.code}>Save {row.cardTitle || row.code}</button>
              </form>
            )
          })}
          </div>

          <header className="edit-head">
            <h2>Care packages</h2>
            <p>A booking multiplies the daily rate by this number. The homepage shows the same multiple.</p>
          </header>
          <div className="edit-grid">
          {catalog.care.map(original => {
            const row = careRow(original)
            return (
              <form className="edit-card" key={row.code} onSubmit={e => {
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
                <div className="edit-top">
                  <div>
                    <p className="edit-kicker">{row.code}</p>
                    <strong>{row.label || row.code}</strong>
                  </div>
                  <Active checked={row.isActive} onChange={value => setCare(s => ({ ...s, [row.code]: { ...row, isActive: value } }))} />
                </div>
                <div className="edit-fields">
                  <Field wide label="Label">
                    <input value={row.label} onChange={e => setCare(s => ({ ...s, [row.code]: { ...row, label: e.target.value } }))} />
                  </Field>
                  <Field label="Hours">
                    <input type="number" min={1} value={row.hours} onChange={e => setCare(s => ({ ...s, [row.code]: { ...row, hours: Number(e.target.value) } }))} />
                  </Field>
                  <Field label="Multiplier" hint="1 is the standard day.">
                    <input type="number" min={0} step="0.1" value={row.multiplier} onChange={e => setCare(s => ({ ...s, [row.code]: { ...row, multiplier: Number(e.target.value) } }))} />
                  </Field>
                  <Field wide label="Hint">
                    <input value={row.hint} onChange={e => setCare(s => ({ ...s, [row.code]: { ...row, hint: e.target.value } }))} />
                  </Field>
                </div>
                <button className="btn-coral" type="submit" disabled={busy === row.code}>Save {row.label || row.code}</button>
              </form>
            )
          })}
          </div>

          <header className="edit-head">
            <h2>Optional add-ons</h2>
            <p>Flat amounts are added once to the quote. Custom add-ons are priced with the family.</p>
          </header>
          <div className="edit-grid">
          {catalog.addons.map(original => {
            const row = addonRow(original)
            return (
              <form className="edit-card" key={row.id} onSubmit={e => {
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
                <div className="edit-top">
                  <strong>{row.name || 'Add-on'}</strong>
                  <Active checked={row.isActive} onChange={value => setAddons(s => ({ ...s, [row.id]: { ...row, isActive: value } }))} />
                </div>
                <div className="edit-fields">
                  <Field wide label="Name">
                    <input value={row.name} onChange={e => setAddons(s => ({ ...s, [row.id]: { ...row, name: e.target.value } }))} />
                  </Field>
                  <Field wide label="Description">
                    <input value={row.description} onChange={e => setAddons(s => ({ ...s, [row.id]: { ...row, description: e.target.value } }))} />
                  </Field>
                  <Field label="Pricing">
                    <select value={row.pricingMode} onChange={e => setAddons(s => ({ ...s, [row.id]: { ...row, pricingMode: e.target.value === 'custom' ? 'custom' : 'flat' } }))}>
                      <option value="flat">Flat amount</option>
                      <option value="custom">Custom quote</option>
                    </select>
                  </Field>
                  <Field label="Amount (KES)">
                    <input type="number" min={0} value={row.amountKes ?? ''} disabled={row.pricingMode === 'custom'} onChange={e => setAddons(s => ({ ...s, [row.id]: { ...row, amountKes: e.target.value === '' ? null : Number(e.target.value) } }))} />
                  </Field>
                </div>
                <div className="ops-card-actions">
                  <button className="btn-coral" type="submit" disabled={busy === row.id}>Save</button>
                  <button className="btn-ghost" type="button" disabled={busy === row.id} onClick={() => run(row.id, () => send('DELETE', undefined, `?kind=addon&id=${encodeURIComponent(row.id)}`))}>Delete</button>
                </div>
              </form>
            )
          })}
          <form className="edit-card" onSubmit={e => {
            e.preventDefault()
            run('new-addon', async () => {
              await send('POST', { kind: 'addon', ...addonDraft, amountKes: addonDraft.pricingMode === 'custom' ? null : addonDraft.amountKes })
              setAddonDraft(EMPTY_ADDON)
            })
          }}>
            <div className="edit-top">
              <strong>New add-on</strong>
            </div>
            <div className="edit-fields">
              <Field wide label="Name">
                <input value={addonDraft.name} onChange={e => setAddonDraft(d => ({ ...d, name: e.target.value }))} />
              </Field>
              <Field wide label="Description">
                <input value={addonDraft.description} onChange={e => setAddonDraft(d => ({ ...d, description: e.target.value }))} />
              </Field>
              <Field label="Pricing">
                <select value={addonDraft.pricingMode} onChange={e => setAddonDraft(d => ({ ...d, pricingMode: e.target.value }))}>
                  <option value="flat">Flat amount</option>
                  <option value="custom">Custom quote</option>
                </select>
              </Field>
              <Field label="Amount (KES)">
                <input type="number" min={0} value={addonDraft.amountKes} disabled={addonDraft.pricingMode === 'custom'} onChange={e => setAddonDraft(d => ({ ...d, amountKes: e.target.value }))} />
              </Field>
            </div>
            <button className="btn-coral" type="submit" disabled={busy === 'new-addon'}>Add add-on</button>
          </form>
          </div>
        </div>
      )}

      {section === 'content' && (
        <div className="edit-stack">
          <header className="edit-head">
            <h2>Booking policies</h2>
            <p>These numbers drive refunds, the replacement clock, and the quote. FAQ answers can insert them with the tokens below.</p>
          </header>
          <form className="edit-card" onSubmit={e => {
            e.preventDefault()
            run('policy', () => send('PATCH', { kind: 'policy', ...policy }))
          }}>
            <div className="edit-tokens">
              {['replacement_hours', 'cancel_full_hours', 'cancel_partial_hours', 'cancel_partial_percent', 'standard_hours', 'lead_hours'].map(token => (
                <code key={token}>{`{{${token}}}`}</code>
              ))}
            </div>
            <div className="edit-fields">
              <Field label="Replacement guarantee (hours)">
                <input type="number" min={1} value={policy.replacementSlaHours} onChange={e => setPolicy({ ...policy, replacementSlaHours: Number(e.target.value) })} />
              </Field>
              <Field label="Full refund window (hours)">
                <input type="number" min={0} value={policy.cancellationFullHours} onChange={e => setPolicy({ ...policy, cancellationFullHours: Number(e.target.value) })} />
              </Field>
              <Field label="Partial refund window (hours)">
                <input type="number" min={0} value={policy.cancellationPartialHours} onChange={e => setPolicy({ ...policy, cancellationPartialHours: Number(e.target.value) })} />
              </Field>
              <Field label="Partial refund percent">
                <input type="number" min={0} max={100} value={policy.cancellationPartialPercent} onChange={e => setPolicy({ ...policy, cancellationPartialPercent: Number(e.target.value) })} />
              </Field>
              <Field label="Standard shift (hours)">
                <input type="number" min={1} value={policy.standardShiftHours} onChange={e => setPolicy({ ...policy, standardShiftHours: Number(e.target.value) })} />
              </Field>
              <Field label="Recommended lead time (hours)">
                <input type="number" min={0} value={policy.recommendedLeadHours} onChange={e => setPolicy({ ...policy, recommendedLeadHours: Number(e.target.value) })} />
              </Field>
              <Field label="Maximum nannies on one booking">
                <input type="number" min={1} value={policy.maxNannies} onChange={e => setPolicy({ ...policy, maxNannies: Number(e.target.value) })} />
              </Field>
            </div>
            <button className="btn-coral" type="submit" disabled={busy === 'policy'}>Save policies</button>
          </form>

          <header className="edit-head">
            <h2>FAQs</h2>
            <p>Questions on the homepage. Answers can use the policy tokens above.</p>
          </header>
          <div className="edit-grid">
          {catalog.faqs.map(original => {
            const row = faqRow(original)
            return (
              <form className="edit-card" key={row.id} onSubmit={e => {
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
                <div className="edit-top">
                  <strong>{row.question || 'Question'}</strong>
                  <Active checked={row.isActive} onChange={value => setFaqs(s => ({ ...s, [row.id]: { ...row, isActive: value } }))} />
                </div>
                <div className="edit-fields">
                  <Field wide label="Question">
                    <input value={row.question} onChange={e => setFaqs(s => ({ ...s, [row.id]: { ...row, question: e.target.value } }))} />
                  </Field>
                  <Field wide label="Answer">
                    <textarea rows={7} value={row.answer} onChange={e => setFaqs(s => ({ ...s, [row.id]: { ...row, answer: e.target.value } }))} />
                  </Field>
                  <Field label="Order">
                    <input type="number" value={row.sortOrder} onChange={e => setFaqs(s => ({ ...s, [row.id]: { ...row, sortOrder: Number(e.target.value) } }))} />
                  </Field>
                </div>
                <div className="ops-card-actions">
                  <button className="btn-coral" type="submit" disabled={busy === row.id}>Save</button>
                  <button className="btn-ghost" type="button" disabled={busy === row.id} onClick={() => run(row.id, () => send('DELETE', undefined, `?kind=faq&id=${encodeURIComponent(row.id)}`))}>Delete</button>
                </div>
              </form>
            )
          })}
          <form className="edit-card" onSubmit={e => {
            e.preventDefault()
            run('new-faq', async () => {
              await send('POST', { kind: 'faq', ...faqDraft })
              setFaqDraft(EMPTY_FAQ)
            })
          }}>
            <div className="edit-top"><strong>New question</strong></div>
            <div className="edit-fields">
              <Field wide label="Question">
                <input value={faqDraft.question} onChange={e => setFaqDraft(d => ({ ...d, question: e.target.value }))} />
              </Field>
              <Field wide label="Answer">
                <textarea rows={4} value={faqDraft.answer} onChange={e => setFaqDraft(d => ({ ...d, answer: e.target.value }))} />
              </Field>
              <Field label="Order">
                <input type="number" value={faqDraft.sortOrder} onChange={e => setFaqDraft(d => ({ ...d, sortOrder: Number(e.target.value) }))} />
              </Field>
            </div>
            <button className="btn-coral" type="submit" disabled={busy === 'new-faq'}>Add question</button>
          </form>
          </div>

          <header className="edit-head">
            <h2>How it works</h2>
            <p>The steps on the homepage, in the order families read them.</p>
          </header>
          <div className="edit-grid">
          {catalog.steps.map(original => {
            const row = stepRow(original)
            return (
              <form className="edit-card" key={row.id} onSubmit={e => {
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
                <div className="edit-top">
                  <div>
                    <p className="edit-kicker">{row.stepLabel || 'Step'}</p>
                    <strong>{row.title || 'Untitled step'}</strong>
                  </div>
                  <Active checked={row.isActive} onChange={value => setSteps(s => ({ ...s, [row.id]: { ...row, isActive: value } }))} />
                </div>
                <div className="edit-fields">
                  <Field label="Step label">
                    <input value={row.stepLabel} onChange={e => setSteps(s => ({ ...s, [row.id]: { ...row, stepLabel: e.target.value } }))} />
                  </Field>
                  <Field label="Title">
                    <input value={row.title} onChange={e => setSteps(s => ({ ...s, [row.id]: { ...row, title: e.target.value } }))} />
                  </Field>
                  <Field wide label="Image URL">
                    <input value={row.imageUrl} onChange={e => setSteps(s => ({ ...s, [row.id]: { ...row, imageUrl: e.target.value } }))} />
                  </Field>
                  <Field wide label="Image description">
                    <input value={row.imageAlt} onChange={e => setSteps(s => ({ ...s, [row.id]: { ...row, imageAlt: e.target.value } }))} />
                  </Field>
                </div>
                <div className="ops-card-actions">
                  <button className="btn-coral" type="submit" disabled={busy === row.id}>Save</button>
                  <button className="btn-ghost" type="button" disabled={busy === row.id} onClick={() => run(row.id, () => send('DELETE', undefined, `?kind=step&id=${encodeURIComponent(row.id)}`))}>Delete</button>
                </div>
              </form>
            )
          })}
          <form className="edit-card" onSubmit={e => {
            e.preventDefault()
            run('new-step', async () => {
              await send('POST', { kind: 'step', ...stepDraft })
              setStepDraft(EMPTY_STEP)
            })
          }}>
            <div className="edit-top"><strong>New step</strong></div>
            <div className="edit-fields">
              <Field label="Step label">
                <input value={stepDraft.stepLabel} onChange={e => setStepDraft(d => ({ ...d, stepLabel: e.target.value }))} />
              </Field>
              <Field label="Title">
                <input value={stepDraft.title} onChange={e => setStepDraft(d => ({ ...d, title: e.target.value }))} />
              </Field>
              <Field wide label="Image URL">
                <input value={stepDraft.imageUrl} onChange={e => setStepDraft(d => ({ ...d, imageUrl: e.target.value }))} />
              </Field>
              <Field wide label="Image description">
                <input value={stepDraft.imageAlt} onChange={e => setStepDraft(d => ({ ...d, imageAlt: e.target.value }))} />
              </Field>
            </div>
            <button className="btn-coral" type="submit" disabled={busy === 'new-step'}>Add step</button>
          </form>
          </div>
        </div>
      )}
    </div>
  )
}
