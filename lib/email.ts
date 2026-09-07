import { Resend } from 'resend'
import { SITE_URL, siteUrl } from '@/lib/constants'

const ADMIN_EMAIL = 'hello@vacaynanny.net'
const FROM_ADDRESS = 'VacayNanny <noreply@vacaynanny.net>'

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

async function sendOrSkip(payload: {
  from: string
  to: string
  subject: string
  html: string
}) {
  const resend = getResend()
  if (!resend) {
    console.warn('RESEND_API_KEY is not set — skipping email')
    return { data: null, error: null }
  }
  return resend.emails.send(payload)
}

// ── Shared wrapper ──────────────────────────────────────────────────────────

function htmlWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VacayNanny</title>
</head>
<body style="margin:0;padding:0;background:#020c14;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#020c14;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0b1e28;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#0d2030,#142838);padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.07);">
          <span style="font-family:Georgia,serif;font-size:26px;font-weight:900;color:#fff;">
            Vacay<span style="color:#E8714A;">Nanny</span>
          </span>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px;color:#fff;">
          ${content}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.2);">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
            VacayNanny · Trusted holiday childcare across East Africa &amp; beyond<br>
            +254 796 930 612 · <a href="mailto:hello@vacaynanny.net" style="color:#E8714A;text-decoration:none;">hello@vacaynanny.net</a>
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

function badge(label: string, color: string): string {
  return `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">${label}</span>`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:rgba(255,255,255,0.45);width:40%;vertical-align:top;">${label}</td>
    <td style="padding:8px 0 8px 16px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:#fff;vertical-align:top;">${value || '—'}</td>
  </tr>`
}

function section(title: string, rows: string): string {
  return `<div style="margin-bottom:28px;">
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#E8714A;">${title}</p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </div>`
}

// ── BOOKING emails ──────────────────────────────────────────────────────────

export async function sendBookingEmails(data: {
  parentName: string
  email: string
  phone: string
  destination: string
  checkIn: string
  checkOut: string
  childrenAges: string
  tier: string
  message: string
}) {
  const tierColors: Record<string, string> = {
    Basic: '#a0663a',
    Professional: '#56687a',
    Elite: '#c9963a',
  }
  const tierColor = tierColors[data.tier] ?? '#E8714A'

  // ── Confirmation to parent ──
  const parentHtml = htmlWrapper(`
    <h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#fff;">
      Booking Request Received ✓
    </h2>
    <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">
      Hi ${data.parentName}, we've received your request and our team will be in touch within <strong style="color:#fff;">a few hours</strong> to confirm your nanny.
    </p>

    ${section('Your booking details',
      row('Destination', data.destination) +
      row('Check-in', data.checkIn) +
      row('Check-out', data.checkOut) +
      row('Children', data.childrenAges) +
      row('Tier', `${badge(data.tier, tierColor)}`) +
      (data.message ? row('Notes', data.message) : '')
    )}

    <div style="background:rgba(232,113,74,0.08);border:1px solid rgba(232,113,74,0.2);border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#fff;">What happens next?</p>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">
        1. We review available nannies at your destination.<br>
        2. We match you with the best fit for your family.<br>
        3. You'll receive a WhatsApp or email confirmation with your nanny's profile.
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);">
      Questions? WhatsApp us at <a href="https://wa.me/254796930612" style="color:#E8714A;text-decoration:none;">+254 796 930 612</a> anytime.
    </p>
  `)

  // ── Admin notification ──
  const adminHtml = htmlWrapper(`
    <h2 style="margin:0 0 4px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;">
      New Booking Request
    </h2>
    <p style="margin:0 0 28px;font-size:13px;color:rgba(255,255,255,0.45);">Submitted just now — action required.</p>

    ${section('Parent details',
      row('Name', data.parentName) +
      row('Email', `<a href="mailto:${data.email}" style="color:#E8714A;">${data.email}</a>`) +
      row('Phone', `<a href="https://wa.me/${data.phone.replace(/\D/g,'')}" style="color:#E8714A;">${data.phone}</a>`)
    )}

    ${section('Booking details',
      row('Destination', data.destination) +
      row('Check-in', data.checkIn) +
      row('Check-out', data.checkOut) +
      row('Children', data.childrenAges) +
      row('Tier', `${badge(data.tier, tierColor)}`) +
      (data.message ? row('Notes', data.message) : '')
    )}
  `)

  const [parentResult, adminResult] = await Promise.all([
    sendOrSkip({
      from: FROM_ADDRESS,
      to: data.email,
      subject: `Your VacayNanny booking request — ${data.destination}`,
      html: parentHtml,
    }),
    sendOrSkip({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `[Booking] ${data.parentName} → ${data.destination} (${data.tier})`,
      html: adminHtml,
    }),
  ])

  if (parentResult.error) console.error('Parent booking email error:', parentResult.error)
  if (adminResult.error) console.error('Admin booking email error:', adminResult.error)
}

// ── NANNY APPLICATION emails ────────────────────────────────────────────────

export async function sendApplicationEmails(data: {
  fullName: string
  email: string
  phone: string
  county: string
  town: string
  experienceYears: string
  cogcStatus: string
  certifications: string[]
  services: string[]
  ageGroups: string[]
  ref1Name: string
  ref2Name: string
  willingToTravel: string
}) {
  const certs = data.certifications?.length ? data.certifications.join(', ') : 'None listed'
  const services = data.services?.length ? data.services.join(', ') : 'None listed'
  const ageGroups = data.ageGroups?.length ? data.ageGroups.join(', ') : 'None listed'

  const travelLabels: Record<string, string> = {
    kenya: 'Anywhere in Kenya',
    international: 'International too',
    county: 'Within county only',
    local: 'Local only',
  }

  // ── Confirmation to nanny ──
  const nannyHtml = htmlWrapper(`
    <h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;font-weight:700;color:#fff;">
      Application Received ✓
    </h2>
    <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">
      Hi ${data.fullName}, thank you for applying to join VacayNanny! Our vetting team will review your application and be in touch within <strong style="color:#fff;">3–5 business days</strong>.
    </p>

    <div style="background:rgba(232,113,74,0.08);border:1px solid rgba(232,113,74,0.2);border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#fff;">What happens next?</p>
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">
        1. <strong style="color:#fff;">Document Review</strong> — we check your ID and any uploaded certificates.<br>
        2. <strong style="color:#fff;">Reference Check</strong> — we contact your references.<br>
        3. <strong style="color:#fff;">Interview</strong> — a short video or phone call with our team.<br>
        4. <strong style="color:#fff;">Profile Goes Live</strong> — you receive your tier badge and start receiving bookings.
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.45);">
      Questions? WhatsApp us at <a href="https://wa.me/254796930612" style="color:#E8714A;text-decoration:none;">+254 796 930 612</a>
    </p>
  `)

  // ── Admin notification ──
  const adminHtml = htmlWrapper(`
    <h2 style="margin:0 0 4px;font-family:Georgia,serif;font-size:22px;font-weight:700;color:#fff;">
      New Nanny Application
    </h2>
    <p style="margin:0 0 28px;font-size:13px;color:rgba(255,255,255,0.45);">Submitted just now — review required.</p>

    ${section('Personal details',
      row('Full name', data.fullName) +
      row('Email', `<a href="mailto:${data.email}" style="color:#E8714A;">${data.email}</a>`) +
      row('Phone', data.phone) +
      row('Location', `${data.town}, ${data.county}`)
    )}

    ${section('Experience & skills',
      row('Years experience', data.experienceYears) +
      row('Age groups', ageGroups) +
      row('Services', services) +
      row('Certifications', certs) +
      row('Good Conduct', data.cogcStatus) +
      row('Travel', travelLabels[data.willingToTravel] ?? data.willingToTravel)
    )}

    ${section('References',
      row('Reference 1', data.ref1Name) +
      row('Reference 2', data.ref2Name)
    )}

    <a href="${SITE_URL}/admin" style="display:inline-block;background:#E8714A;color:#fff;border-radius:50px;padding:12px 28px;font-size:14px;font-weight:600;text-decoration:none;margin-top:8px;">
      View in admin →
    </a>
  `)

  const [nannyResult, adminResult] = await Promise.all([
    sendOrSkip({
      from: FROM_ADDRESS,
      to: data.email,
      subject: 'Your VacayNanny application has been received',
      html: nannyHtml,
    }),
    sendOrSkip({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `[Application] ${data.fullName} — ${data.county}`,
      html: adminHtml,
    }),
  ])

  if (nannyResult.error) console.error('Nanny application email error:', nannyResult.error)
  if (adminResult.error) console.error('Admin application email error:', adminResult.error)
}

// ── Booking lifecycle emails ────────────────────────────────────────────────

export type BookingEmailEvent =
  | 'matched'
  | 'nanny_accepted'
  | 'nanny_declined'
  | 'parent_confirmed'
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'replacement_started'
  | 'replacement_assigned'
  | 'replacement_refunded'
  | 'in_progress'
  | 'completed'

export type BookingMailContext = {
  parentName: string
  parentEmail: string
  nannyName?: string | null
  nannyEmail?: string | null
  extraNannyName?: string | null
  extraNannyEmail?: string | null
  destination: string
  checkIn: string
  checkOut: string
  careType: string
  status: string
  totalKes?: number | null
  refundPercent?: number | null
  note?: string | null
}

function bookingDetails(ctx: BookingMailContext): string {
  return section('Booking',
    row('Destination', ctx.destination) +
    row('Check-in', ctx.checkIn) +
    row('Check-out', ctx.checkOut) +
    row('Care', ctx.careType) +
    row('Nanny', ctx.nannyName || 'To be matched') +
    (ctx.totalKes != null ? row('Estimate', `KES ${ctx.totalKes.toLocaleString('en-KE')}`) : '') +
    (ctx.note ? row('Note', ctx.note) : ''),
  )
}

function eventCopy(event: BookingEmailEvent, ctx: BookingMailContext): {
  parentSubject: string
  parentBody: string
  nannySubject: string
  nannyBody: string
  adminSubject: string
  adminBody: string
  extraSubject?: string
  extraBody?: string
} {
  const familyLink = siteUrl('/account')
  const nannyLink = siteUrl('/nanny')
  const adminLink = siteUrl('/admin')
  const details = bookingDetails(ctx)

  switch (event) {
    case 'matched':
      return {
        parentSubject: `We've proposed a nanny for ${ctx.destination}`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Nanny proposed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">Hi ${ctx.parentName}, ${ctx.nannyName || 'A VacayNanny'} is proposed for your trip. Open your account to confirm the match.</p>
          ${details}
          <p><a href="${familyLink}" style="color:#E8714A;">Confirm in your account →</a></p>`,
        nannySubject: `New placement proposed — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">You've been assigned</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">Hi ${ctx.nannyName || 'there'}, please accept or decline this placement in your dashboard.</p>
          ${details}
          <p><a href="${nannyLink}" style="color:#E8714A;">Open nanny dashboard →</a></p>`,
        adminSubject: `[Matched] ${ctx.parentName} → ${ctx.nannyName || 'nanny'} (${ctx.destination})`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Nanny assigned</h2>${details}<p><a href="${adminLink}" style="color:#E8714A;">Open admin →</a></p>`,
      }
    case 'nanny_accepted':
      return {
        parentSubject: `${ctx.nannyName || 'Your nanny'} accepted — confirm to lock the dates`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Nanny accepted</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">${ctx.nannyName || 'Your nanny'} accepted the placement. Confirm in your account to lock it in.</p>
          ${details}
          <p><a href="${familyLink}" style="color:#E8714A;">Confirm match →</a></p>`,
        nannySubject: `You accepted ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Accepted</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">We'll email you once the family confirms.</p>${details}`,
        adminSubject: `[Accepted] ${ctx.nannyName || 'Nanny'} accepted ${ctx.parentName}`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Nanny accepted</h2>${details}`,
      }
    case 'nanny_declined':
      return {
        parentSubject: `We're rematching your ${ctx.destination} booking`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Rematching</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">The proposed nanny isn't available. Our team is matching someone else and will update you shortly.</p>${details}`,
        nannySubject: `Assignment declined — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Declined</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">We recorded that you declined this placement.</p>${details}`,
        adminSubject: `[Declined] Rematch needed for ${ctx.parentName}`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Nanny declined</h2>${details}<p><a href="${adminLink}" style="color:#E8714A;">Rematch in admin →</a></p>`,
        extraSubject: `Assignment declined — ${ctx.destination}`,
        extraBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Declined</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">We recorded that you declined this placement.</p>${details}`,
      }
    case 'parent_confirmed':
      return {
        parentSubject: `You confirmed ${ctx.nannyName || 'your nanny'} — waiting on acceptance`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">You confirmed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">We'll lock the booking as soon as ${ctx.nannyName || 'your nanny'} accepts.</p>${details}`,
        nannySubject: `Family confirmed — please accept ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Family confirmed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">${ctx.parentName} confirmed this match. Accept in your dashboard to lock it in.</p>
          ${details}<p><a href="${nannyLink}" style="color:#E8714A;">Accept placement →</a></p>`,
        adminSubject: `[Family confirmed] ${ctx.parentName} / ${ctx.destination}`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Family confirmed</h2>${details}`,
      }
    case 'confirmed':
      return {
        parentSubject: `Booking confirmed — ${ctx.destination}`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">You're booked</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">${ctx.nannyName || 'Your nanny'} is confirmed for your trip.</p>${details}
          <p><a href="${familyLink}" style="color:#E8714A;">View booking →</a></p>`,
        nannySubject: `Placement confirmed — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Confirmed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">This placement is locked in. See dates on your dashboard calendar.</p>${details}`,
        adminSubject: `[Confirmed] ${ctx.parentName} × ${ctx.nannyName || 'nanny'}`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Booking confirmed</h2>${details}`,
      }
    case 'rescheduled':
      return {
        parentSubject: `Dates updated — ${ctx.destination}`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Rescheduled</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">Your booking dates were updated.</p>${details}`,
        nannySubject: `Dates changed — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Dates changed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">Please check the new dates on your calendar.</p>${details}`,
        adminSubject: `[Rescheduled] ${ctx.parentName} — ${ctx.checkIn} → ${ctx.checkOut}`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Rescheduled</h2>${details}`,
      }
    case 'cancelled':
      return {
        parentSubject: `Booking cancelled — ${ctx.destination}`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Cancelled</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">Your booking was cancelled. Refund: ${ctx.refundPercent ?? 0}% of the booking fee per our policy.</p>${details}`,
        nannySubject: `Placement cancelled — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Cancelled</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">This placement is no longer on your calendar.</p>${details}`,
        adminSubject: `[Cancelled] ${ctx.parentName} — ${ctx.refundPercent ?? 0}% refund`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Cancelled</h2>${details}`,
      }
    case 'replacement_started':
      return {
        parentSubject: `We're placing a replacement nanny within 2 hours`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Replacement in progress</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">Your nanny can't make this placement. We guarantee a replacement within 2 hours, or we refund the booking fee.</p>${details}`,
        nannySubject: `You've been taken off ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Replacement started</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">This placement was released from your calendar.</p>${details}`,
        adminSubject: `[Replacement SLA] ${ctx.parentName} — 2 hours`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Replacement clock started</h2>
          <p style="color:rgba(255,255,255,0.65);">Assign a new nanny within 2 hours or refund the booking fee.</p>${details}
          <p><a href="${adminLink}" style="color:#E8714A;">Assign replacement →</a></p>`,
        extraSubject: `You've been taken off ${ctx.destination}`,
        extraBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Replacement started</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">This placement was released from your calendar.</p>${details}`,
      }
    case 'replacement_assigned':
      return {
        parentSubject: `Replacement nanny proposed — ${ctx.nannyName || 'VacayNanny'}`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Replacement proposed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">Please confirm ${ctx.nannyName || 'your new nanny'} in your account.</p>
          ${details}<p><a href="${familyLink}" style="color:#E8714A;">Confirm replacement →</a></p>`,
        nannySubject: `Replacement placement — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Replacement assignment</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">Please accept or decline this coverage placement.</p>
          ${details}<p><a href="${nannyLink}" style="color:#E8714A;">Respond now →</a></p>`,
        adminSubject: `[Replacement assigned] ${ctx.nannyName || 'nanny'} → ${ctx.parentName}`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Replacement assigned</h2>${details}`,
      }
    case 'replacement_refunded':
      return {
        parentSubject: `Booking fee refunded — ${ctx.destination}`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Guarantee applied</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">We couldn't place a replacement nanny in time. Your booking fee is refunded in full.</p>${details}`,
        nannySubject: `Placement closed — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Closed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">This placement was closed under the replacement guarantee.</p>${details}`,
        adminSubject: `[Guarantee refund] ${ctx.parentName} — 100%`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Replacement guarantee refunded</h2>${details}`,
      }
    case 'in_progress':
      return {
        parentSubject: `Your nanny placement has started — ${ctx.destination}`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Placement started</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">${ctx.nannyName || 'Your nanny'} is now on assignment. WhatsApp us if you need a replacement.</p>${details}`,
        nannySubject: `Placement in progress — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">In progress</h2>${details}`,
        adminSubject: `[In progress] ${ctx.parentName} — ${ctx.destination}`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">In progress</h2>${details}`,
      }
    case 'completed':
      return {
        parentSubject: `Thanks for booking VacayNanny — ${ctx.destination}`,
        parentBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Completed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">We hope the placement went smoothly. Reply to this email if you'd like to leave a note for the team.</p>${details}`,
        nannySubject: `Placement completed — ${ctx.destination}`,
        nannyBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:24px;color:#fff;">Completed</h2>
          <p style="color:rgba(255,255,255,0.65);line-height:1.6;">This placement is complete. Payouts are processed by VacayNanny after completed bookings.</p>${details}`,
        adminSubject: `[Completed] ${ctx.parentName} — ${ctx.destination}`,
        adminBody: `<h2 style="margin:0 0 8px;font-family:Georgia,serif;font-size:22px;color:#fff;">Completed</h2>${details}`,
      }
    default: {
      const _never: never = event
      return _never
    }
  }
}

export async function notifyBookingEvent(event: BookingEmailEvent, ctx: BookingMailContext) {
  const copy = eventCopy(event, ctx)
  const wrapped = (html: string) => htmlWrapper(html)
  const sends = [
    sendOrSkip({
      from: FROM_ADDRESS,
      to: ctx.parentEmail,
      subject: copy.parentSubject,
      html: wrapped(copy.parentBody),
    }),
    sendOrSkip({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: copy.adminSubject,
      html: wrapped(copy.adminBody),
    }),
  ]
  if (ctx.nannyEmail) {
    sends.push(sendOrSkip({
      from: FROM_ADDRESS,
      to: ctx.nannyEmail,
      subject: copy.nannySubject,
      html: wrapped(copy.nannyBody),
    }))
  }
  if (ctx.extraNannyEmail && ctx.extraNannyEmail !== ctx.nannyEmail && copy.extraSubject && copy.extraBody) {
    sends.push(sendOrSkip({
      from: FROM_ADDRESS,
      to: ctx.extraNannyEmail,
      subject: copy.extraSubject,
      html: wrapped(copy.extraBody),
    }))
  }
  const results = await Promise.all(sends)
  results.forEach((r, i) => {
    if (r.error) console.error(`Booking lifecycle email ${i} (${event}) failed:`, r.error)
  })
}
