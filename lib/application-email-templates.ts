export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  )
}

const agreementIntroduction =
  'Attached to this email is your VacayNanny Nanny Code of Conduct and Marketplace Participation Agreement.'

function paragraphHtml(paragraph: string) {
  if (paragraph === 'Kind regards,\nThe VacayNanny Team') {
    return 'Kind regards,<br><strong>The VacayNanny Team</strong>'
  }
  if (paragraph.startsWith(agreementIntroduction)) {
    return `<strong>${escapeHtml(agreementIntroduction)}</strong>${escapeHtml(paragraph.slice(agreementIntroduction.length))}`
  }
  return escapeHtml(paragraph).replace(/\n/g, '<br>')
}

function template(paragraphs: string[]) {
  return {
    text: paragraphs.join('\n\n'),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VacayNanny</title></head><body style="margin:0;padding:30px 16px;background:#FFF8EF;font-family:Arial,sans-serif;color:#17324D"><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:#FFFCF7;border:1px solid #DFE1D6;border-radius:12px"><tr><td style="padding:32px"><div style="font-family:Georgia,serif;font-size:26px;margin-bottom:28px">VacayNanny<span style="color:#F27C70">.</span></div>${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.8;margin:0 0 18px">${paragraphHtml(p)}</p>`).join('')}</td></tr></table></body></html>`,
  }
}

export function applicationReceivedTemplate(name: string) {
  return template([
    `Hi ${name},`,
    'Thank you for applying to join VacayNanny.',
    'We have successfully received your application and the information you submitted. Our team will now review your details, qualifications, experience and supporting documents as part of our verification process.',
    'Your application is currently under review. We will contact you by email once the review and verification process is complete, and let you know the next steps.',
    'Please note that submitting an application does not automatically mean that your profile has been approved or that you can begin accepting bookings.',
    'Thank you for your interest in becoming part of VacayNanny. We appreciate the care and responsibility that comes with looking after children, and we look forward to getting to know you.',
    'Kind regards,\nThe VacayNanny Team',
  ])
}

export function applicationApprovedTemplate(name: string) {
  return template([
    `Hi ${name},`,
    'Good news! Your VacayNanny application has been reviewed and approved.',
    'We are pleased to welcome you to the VacayNanny nanny community.',
    'Before your profile can be published and you can start receiving booking requests, there is one final step.',
    'Attached to this email is your VacayNanny Nanny Code of Conduct and Marketplace Participation Agreement. This document outlines the professional standards, child-safeguarding requirements, dress code, tier benefits, payment arrangements and responsibilities expected of every nanny on our platform.',
    'Please take time to read through the agreement carefully, complete the required details, sign it and send the signed copy back to us by replying to this email with the completed document attached.',
    'Once we receive and review your signed agreement, we will activate your nanny profile and notify you when it is live and visible to families.',
    'We look forward to having you as part of the VacayNanny community and working together to provide families with safe, reliable and quality childcare.',
    'Welcome aboard!',
    'Kind regards,\nThe VacayNanny Team',
  ])
}
