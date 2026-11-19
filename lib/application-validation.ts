import { validIsoDate } from './booking-validation'
import { DAYS_OF_WEEK } from './constants'

export function validateApplication(
  body: Record<string, unknown>,
  fileKinds: Iterable<string>,
  now = new Date(),
): string[] {
  const errors: string[] = []
  const text = (key: string) =>
    typeof body[key] === 'string' ? String(body[key]).trim() : ''
  const list = (key: string) =>
    Array.isArray(body[key])
      ? (body[key] as unknown[]).filter((v) => typeof v === 'string' && v.trim())
      : []
  for (const [key, label] of Object.entries({
    fullName: 'Full name',
    email: 'Email',
    phone: 'Phone',
    gender: 'Gender',
    county: 'County',
    town: 'Town',
    nationalIdNumber: 'National ID number',
    cogcStatus: 'Police clearance status',
    willingToTravel: 'Travel preference',
  }))
    if (!text(key)) errors.push(`${label} is required.`)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text('email')))
    errors.push('Enter a valid email address.')
  if (text('phone').replace(/\D/g, '').length < 9)
    errors.push('Enter a valid phone number.')
  const dob = text('dateOfBirth'),
    cutoff = new Date(now)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 21)
  if (
    !validIsoDate(dob) ||
    Date.parse(dob) > cutoff.getTime() ||
    Date.parse(dob) < now.getTime() - 110 * 365.25 * 86400000
  )
    errors.push('Applicants must be at least 21 years old with a valid date of birth.')
  for (const [key, label] of Object.entries({
    languages: 'language',
    ageGroups: 'age group',
    services: 'service',
    availableDays: 'available day',
  }))
    if (!list(key).length) errors.push(`Select at least one ${label}.`)
  if (
    list('availableDays').some(
      (v) => !DAYS_OF_WEEK.includes(v as (typeof DAYS_OF_WEEK)[number]),
    )
  )
    errors.push('Choose valid available days.')
  if (!/^\d{1,2}$/.test(text('experienceYears')))
    errors.push('Provide valid years of experience.')
  for (const key of ['consentBackground', 'consentTerms', 'consentAccuracy'])
    if (body[key] !== true) errors.push('All application consents must be accepted.')
  for (const index of [1, 2]) {
    if (
      !text(`ref${index}Name`) ||
      !text(`ref${index}Relationship`) ||
      text(`ref${index}Phone`).replace(/\D/g, '').length < 9
    )
      errors.push(`Reference ${index} needs a name, relationship and valid phone number.`)
    const email = text(`ref${index}Email`)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.push(`Reference ${index} email is invalid.`)
  }
  if (text('ref1Phone').replace(/\D/g, '') === text('ref2Phone').replace(/\D/g, ''))
    errors.push('Provide two different reference phone numbers.')
  if (
    text('ref1Email') &&
    text('ref1Email').toLowerCase() === text('ref2Email').toLowerCase()
  )
    errors.push('Provide two different reference emails.')
  const kinds = new Set(fileKinds)
  for (const [kind, label] of Object.entries({
    photo: 'Passport-style photo',
    id_front: 'ID front',
    id_back: 'ID back',
    selfie: 'Identity selfie',
  }))
    if (!kinds.has(kind)) errors.push(`${label} is required.`)
  if (['yes', 'have'].includes(text('cogcStatus')) && !kinds.has('cogc'))
    errors.push('Upload the police clearance certificate you declared.')
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value.length > (key === 'bio' ? 2000 : 300))
      errors.push(`${key} is too long.`)
    if (
      Array.isArray(value) &&
      (value.length > 30 ||
        value.some((item) => typeof item !== 'string' || item.length > 150))
    )
      errors.push(`${key} contains invalid choices.`)
  }
  return [...new Set(errors)]
}
