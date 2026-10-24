import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { normalizeTier, slugify } from '@/lib/constants'
import { parseCareType } from '@/lib/booking'
import { createServerClient, hasSupabaseConfig } from '@/lib/supabase'
import type { CareType, NannyTier } from '@/lib/types'

const KINDS = ['tier', 'care', 'addon', 'faq', 'step', 'policy'] as const
type Kind = (typeof KINDS)[number]

function isKind(value: unknown): value is Kind {
  return KINDS.includes(value as Kind)
}

function text(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max)
}

function lines(value: unknown) {
  const source = Array.isArray(value) ? value.map(item => String(item)) : String(value ?? '').split('\n')
  return source.map(line => line.trim()).filter(Boolean).slice(0, 24)
}

function whole(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

function active(value: unknown) {
  return value !== false && value !== 'false'
}

async function gate() {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'The catalog is not configured yet.' }, { status: 503 })
  }
  return null
}

function tierFields(body: Record<string, unknown>, code: NannyTier) {
  const rate = whole(body.dailyRateKes ?? body.daily_rate_kes, -1)
  if (rate < 0 || rate > 1_000_000) return { error: 'Enter a daily rate of 0 or more.' }
  return {
    value: {
      code,
      label: text(body.label, 40) || code,
      card_title: text(body.cardTitle ?? body.card_title, 40) || code,
      badge: text(body.badge, 24),
      description: text(body.description, 400),
      period: text(body.period, 120),
      daily_rate_kes: rate,
      features: lines(body.features),
      cta: text(body.cta, 40) || 'Book',
      sort_order: whole(body.sortOrder ?? body.sort_order, 0),
      is_active: active(body.isActive ?? body.is_active),
      updated_at: new Date().toISOString(),
    },
  }
}

function careFields(body: Record<string, unknown>, code: CareType) {
  const hours = whole(body.hours, 0)
  const multiplier = Number(body.multiplier)
  if (hours < 1 || hours > 24) return { error: 'Hours must be between 1 and 24.' }
  if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 10) return { error: 'Multiplier must be greater than 0 and at most 10.' }
  return {
    value: {
      code,
      label: text(body.label, 80) || code,
      hours,
      multiplier,
      hint: text(body.hint, 240),
      sort_order: whole(body.sortOrder ?? body.sort_order, 0),
      is_active: active(body.isActive ?? body.is_active),
      updated_at: new Date().toISOString(),
    },
  }
}

function addonFields(body: Record<string, unknown>, code: string) {
  const mode = body.pricingMode === 'custom' || body.pricing_mode === 'custom' ? 'custom' : 'flat'
  const amountRaw = body.amountKes ?? body.amount_kes
  const amount = mode === 'custom' || amountRaw === '' || amountRaw == null ? null : whole(amountRaw, -1)
  if (mode === 'flat' && (amount == null || amount < 0 || amount > 1_000_000)) {
    return { error: 'Enter an add-on price of 0 or more, or mark it as a custom quote.' }
  }
  const name = text(body.name, 80)
  if (!name) return { error: 'Name is required.' }
  return {
    value: {
      code,
      name,
      description: text(body.description, 240),
      amount_kes: amount,
      pricing_mode: mode,
      sort_order: whole(body.sortOrder ?? body.sort_order, 0),
      is_active: active(body.isActive ?? body.is_active),
      updated_at: new Date().toISOString(),
    },
  }
}

function policyFields(body: Record<string, unknown>) {
  const replacement = whole(body.replacementSlaHours ?? body.replacement_sla_hours, 0)
  const full = whole(body.cancellationFullHours ?? body.cancellation_full_hours, -1)
  const partial = whole(body.cancellationPartialHours ?? body.cancellation_partial_hours, -1)
  const percent = whole(body.cancellationPartialPercent ?? body.cancellation_partial_percent, -1)
  const shift = whole(body.standardShiftHours ?? body.standard_shift_hours, 0)
  const lead = whole(body.recommendedLeadHours ?? body.recommended_lead_hours, -1)
  const maxNannies = whole(body.maxNannies ?? body.max_nannies, 0)
  if (replacement < 1 || replacement > 168) return { error: 'Replacement hours must be from 1 to 168.' }
  if (full < 0 || partial < 0 || partial > full) return { error: 'The partial-refund window has to end at or before the full-refund window.' }
  if (percent < 0 || percent > 100) return { error: 'Partial refund percent must be from 0 to 100.' }
  if (shift < 1 || shift > 24) return { error: 'Standard shift hours must be from 1 to 24.' }
  if (lead < 0 || lead > 720) return { error: 'Recommended lead time must be from 0 to 720 hours.' }
  if (maxNannies < 1 || maxNannies > 10) return { error: 'Maximum nannies must be from 1 to 10.' }
  return {
    value: {
      id: 1,
      replacement_sla_hours: replacement,
      cancellation_full_hours: full,
      cancellation_partial_hours: partial,
      cancellation_partial_percent: percent,
      standard_shift_hours: shift,
      recommended_lead_hours: lead,
      max_nannies: maxNannies,
      updated_at: new Date().toISOString(),
    },
  }
}

export async function POST(request: NextRequest) {
  const denied = await gate()
  if (denied) return denied
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (!isKind(body.kind)) return NextResponse.json({ error: 'Unknown catalog item.' }, { status: 400 })
  const supabase = createServerClient()

  if (body.kind === 'tier') {
    const code = normalizeTier(String(body.code || ''))
    if (!code) return NextResponse.json({ error: 'Tier must be bronze, silver, or gold.' }, { status: 400 })
    const parsed = tierFields(body, code)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { error } = await supabase.from('pricing_tiers').insert([parsed.value])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.kind === 'care') {
    const code = parseCareType(body.code)
    if (!['standard', 'extended', 'overnight'].includes(String(body.code || ''))) {
      return NextResponse.json({ error: 'Care package must be standard, extended, or overnight.' }, { status: 400 })
    }
    const parsed = careFields(body, code)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { error } = await supabase.from('care_offerings').insert([parsed.value])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.kind === 'addon') {
    const code = slugify(text(body.code, 60) || text(body.name, 80))
    if (!code) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    const parsed = addonFields(body, code)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { error } = await supabase.from('pricing_addons').insert([parsed.value])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.kind === 'faq') {
    const question = text(body.question, 200)
    const answer = text(body.answer, 4000)
    if (!question || !answer) return NextResponse.json({ error: 'Question and answer are required.' }, { status: 400 })
    const { error } = await supabase.from('faqs').insert([{
      question,
      answer,
      sort_order: whole(body.sortOrder, 0),
      is_active: active(body.isActive),
      updated_at: new Date().toISOString(),
    }])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.kind === 'step') {
    const title = text(body.title, 80)
    const imageUrl = text(body.imageUrl ?? body.image_url, 400)
    if (!title || !imageUrl) return NextResponse.json({ error: 'Title and image URL are required.' }, { status: 400 })
    const { error } = await supabase.from('homepage_steps').insert([{
      step_label: text(body.stepLabel ?? body.step_label, 40) || 'Step',
      title,
      image_url: imageUrl,
      image_alt: text(body.imageAlt ?? body.image_alt, 120) || title,
      sort_order: whole(body.sortOrder, 0),
      is_active: active(body.isActive),
      updated_at: new Date().toISOString(),
    }])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Use save for policies.' }, { status: 400 })
}

export async function PATCH(request: NextRequest) {
  const denied = await gate()
  if (denied) return denied
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  if (!isKind(body.kind)) return NextResponse.json({ error: 'Unknown catalog item.' }, { status: 400 })
  const supabase = createServerClient()

  if (body.kind === 'tier') {
    const code = normalizeTier(String(body.code || ''))
    if (!code) return NextResponse.json({ error: 'Unknown tier.' }, { status: 400 })
    const parsed = tierFields(body, code)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { error } = await supabase.from('pricing_tiers').update({
      label: parsed.value.label,
      card_title: parsed.value.card_title,
      badge: parsed.value.badge,
      description: parsed.value.description,
      period: parsed.value.period,
      daily_rate_kes: parsed.value.daily_rate_kes,
      features: parsed.value.features,
      cta: parsed.value.cta,
      sort_order: parsed.value.sort_order,
      is_active: parsed.value.is_active,
      updated_at: parsed.value.updated_at,
    }).eq('code', code)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.kind === 'care') {
    const code = String(body.code || '')
    if (!['standard', 'extended', 'overnight'].includes(code)) {
      return NextResponse.json({ error: 'Unknown care package.' }, { status: 400 })
    }
    const parsed = careFields(body, parseCareType(code))
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { error } = await supabase.from('care_offerings').update({
      label: parsed.value.label,
      hours: parsed.value.hours,
      multiplier: parsed.value.multiplier,
      hint: parsed.value.hint,
      sort_order: parsed.value.sort_order,
      is_active: parsed.value.is_active,
      updated_at: parsed.value.updated_at,
    }).eq('code', code)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.kind === 'addon') {
    const id = text(body.id, 80)
    const code = slugify(text(body.code, 60))
    if (!id || !code) return NextResponse.json({ error: 'Add-on id is required.' }, { status: 400 })
    const parsed = addonFields(body, code)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const { error } = await supabase.from('pricing_addons').update(parsed.value).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.kind === 'faq') {
    const id = text(body.id, 80)
    const question = text(body.question, 200)
    const answer = text(body.answer, 4000)
    if (!id || !question || !answer) return NextResponse.json({ error: 'Question and answer are required.' }, { status: 400 })
    const { error } = await supabase.from('faqs').update({
      question,
      answer,
      sort_order: whole(body.sortOrder, 0),
      is_active: active(body.isActive),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.kind === 'step') {
    const id = text(body.id, 80)
    const title = text(body.title, 80)
    const imageUrl = text(body.imageUrl ?? body.image_url, 400)
    if (!id || !title || !imageUrl) return NextResponse.json({ error: 'Title and image URL are required.' }, { status: 400 })
    const { error } = await supabase.from('homepage_steps').update({
      step_label: text(body.stepLabel ?? body.step_label, 40) || 'Step',
      title,
      image_url: imageUrl,
      image_alt: text(body.imageAlt ?? body.image_alt, 120) || title,
      sort_order: whole(body.sortOrder, 0),
      is_active: active(body.isActive),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const parsed = policyFields(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { error } = await supabase.from('business_policies').upsert([parsed.value])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  const denied = await gate()
  if (denied) return denied
  const kind = request.nextUrl.searchParams.get('kind')
  const id = request.nextUrl.searchParams.get('id') || ''
  if (kind !== 'addon' && kind !== 'faq' && kind !== 'step') {
    return NextResponse.json({ error: 'That item cannot be deleted.' }, { status: 400 })
  }
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  const table = kind === 'addon' ? 'pricing_addons' : kind === 'faq' ? 'faqs' : 'homepage_steps'
  const { error } = await createServerClient().from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
