import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ADMIN_EMAIL = 'hello@vacaynanny.net'
const FROM_ADDRESS = 'VacayNanny <noreply@vacaynanny.net>'

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
    resend.emails.send({
      from: FROM_ADDRESS,
      to: data.email,
      subject: `Your VacayNanny booking request — ${data.destination}`,
      html: parentHtml,
    }),
    resend.emails.send({
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

    <a href="https://supabase.com" style="display:inline-block;background:#E8714A;color:#fff;border-radius:50px;padding:12px 28px;font-size:14px;font-weight:600;text-decoration:none;margin-top:8px;">
      View in Supabase →
    </a>
  `)

  const [nannyResult, adminResult] = await Promise.all([
    resend.emails.send({
      from: FROM_ADDRESS,
      to: data.email,
      subject: 'Your VacayNanny application has been received',
      html: nannyHtml,
    }),
    resend.emails.send({
      from: FROM_ADDRESS,
      to: ADMIN_EMAIL,
      subject: `[Application] ${data.fullName} — ${data.county}`,
      html: adminHtml,
    }),
  ])

  if (nannyResult.error) console.error('Nanny application email error:', nannyResult.error)
  if (adminResult.error) console.error('Admin application email error:', adminResult.error)
}
