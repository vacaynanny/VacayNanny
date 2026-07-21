'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

/* ── Country codes ── */
const COUNTRY_CODES = [
  { flag: '🇰🇪', code: '+254', label: 'Kenya' },
  { flag: '🇺🇬', code: '+256', label: 'Uganda' },
  { flag: '🇹🇿', code: '+255', label: 'Tanzania' },
  { flag: '🇷🇼', code: '+250', label: 'Rwanda' },
  { flag: '🇬🇧', code: '+44',  label: 'UK' },
  { flag: '🇺🇸', code: '+1',   label: 'USA' },
]

/* ── Kenya phone validation ── */
function isValidKenyanNumber(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length !== 9) return false
  const validPrefixes = ['70','71','72','73','74','75','76','77','78','79','11']
  return validPrefixes.some(p => cleaned.startsWith(p))
}

/* ── Age validation (must be >= 21) ── */
function checkAge(dob: string): boolean {
  if (!dob) return false
  const d = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age >= 21
}

/* ── Steps config ── */
const STEPS = [
  'Personal Info',
  'Identity',
  'Background',
  'Experience',
  'Skills',
  'References',
  'Availability',
  'Review & Submit',
]

/* ── Checkbox group helper ── */
function CheckItem({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className={`check-item${checked ? ' checked' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <div className={`check-box${checked ? ' checked' : ''}`}>{checked ? '✓' : ''}</div>
      <span className="check-label">{label}</span>
    </div>
  )
}

/* ── Radio card helper ── */
function RadioCard({
  label, selected, onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <div className={`radio-card${selected ? ' selected' : ''}`} onClick={onClick}>
      <div className={`radio-dot${selected ? ' selected' : ''}`} />
      <span className="radio-label">{label}</span>
    </div>
  )
}

/* ── Phone input with country code ── */
function PhoneInput({
  value, onChange, countryCode, onCodeChange,
}: {
  value: string; onChange: (v: string) => void;
  countryCode: string; onCodeChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false)
  const current = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0]
  return (
    <div className="phone-wrap" style={{ position: 'relative' }}>
      <div className="country-code-btn" onClick={() => setOpen(o => !o)}>
        <span>{current.flag}</span>
        <span>{current.code}</span>
        <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>▼</span>
      </div>
      <div className={`cc-dropdown${open ? ' open' : ''}`}>
        {COUNTRY_CODES.map(cc => (
          <div
            key={cc.code}
            className="cc-option"
            onClick={() => { onCodeChange(cc.code); setOpen(false) }}
          >
            <span>{cc.flag}</span>
            <span>{cc.label}</span>
            <span style={{ marginLeft: 'auto', opacity: 0.5 }}>{cc.code}</span>
          </div>
        ))}
      </div>
      <input
        type="tel"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="7xx xxx xxx"
        style={{ background: 'transparent', border: 'none', borderRadius: '0 10px 10px 0', flex: 1 }}
      />
    </div>
  )
}

/* ── Upload box ── */
function UploadBox({
  label, hint, name, onFile,
}: {
  label: string; hint?: string; name: string; onFile: (name: string, hasFile: boolean) => void;
}) {
  const [filename, setFilename] = useState('')
  return (
    <div className={`upload-box${filename ? ' uploaded' : ''}`}>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={e => {
          const f = e.target.files?.[0]?.name || ''
          setFilename(f)
          onFile(name, !!f)
        }}
      />
      <div className="upload-icon">{filename ? '✅' : '📁'}</div>
      <p>{filename || label}</p>
      {hint && <span>{hint}</span>}
    </div>
  )
}

/* ── Main component ── */
export default function BecomeANanny() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  // ── Form state ──
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [countryCode, setCountryCode] = useState('+254')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [county, setCounty] = useState('')
  const [town, setTown] = useState('')
  const [languages, setLanguages] = useState<string[]>([])
  const [bio, setBio] = useState('')

  // Step 2 – Identity
  const [idNumber, setIdNumber] = useState('')
  const [kraPin, setKraPin] = useState('')
  const [uploads, setUploads] = useState<Record<string, boolean>>({})

  // Step 3 – Background
  const [cogcStatus, setCogcStatus] = useState('')
  const [cogcDate, setCogcDate] = useState('')

  // Step 4 – Experience
  const [expYears, setExpYears] = useState('')
  const [ageGroups, setAgeGroups] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [certifications, setCertifications] = useState<string[]>([''])

  // Step 5 – Skills (already captured in services/ageGroups)
  const [swimming, setSwimming] = useState('')
  const [cooking, setCooking] = useState('')
  const [tutoring, setTutoring] = useState('')
  const [driving, setDriving] = useState('')
  const [specialNeeds, setSpecialNeeds] = useState('')

  // Step 6 – References
  const [ref1Name, setRef1Name] = useState('')
  const [ref1Rel, setRef1Rel] = useState('')
  const [ref1Employer, setRef1Employer] = useState('')
  const [ref1Phone, setRef1Phone] = useState('')
  const [ref1Email, setRef1Email] = useState('')
  const [ref1Contact, setRef1Contact] = useState('+254')

  const [ref2Name, setRef2Name] = useState('')
  const [ref2Rel, setRef2Rel] = useState('')
  const [ref2Employer, setRef2Employer] = useState('')
  const [ref2Phone, setRef2Phone] = useState('')
  const [ref2Email, setRef2Email] = useState('')
  const [ref2Contact, setRef2Contact] = useState('+254')

  // Step 7 – Availability
  const [availDays, setAvailDays] = useState<string[]>([])
  const [earliestStart, setEarliestStart] = useState('')
  const [latestEnd, setLatestEnd] = useState('')
  const [willingTravel, setWillingTravel] = useState('')
  const [prefLocations, setPrefLocations] = useState<string[]>([])
  const [comfortPets, setComfortPets] = useState('')
  const [comfortMultiple, setComfortMultiple] = useState('')

  // Consent
  const [consent1, setConsent1] = useState(false)
  const [consent2, setConsent2] = useState(false)
  const [consent3, setConsent3] = useState(false)

  // SessionStorage autosave
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('vn_nanny_form')
      if (saved) {
        const d = JSON.parse(saved)
        if (d.firstName) setFirstName(d.firstName)
        if (d.lastName) setLastName(d.lastName)
        if (d.dob) setDob(d.dob)
        if (d.gender) setGender(d.gender)
        if (d.phone) setPhone(d.phone)
        if (d.email) setEmail(d.email)
        if (d.county) setCounty(d.county)
        if (d.town) setTown(d.town)
        if (d.step) setStep(d.step)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem('vn_nanny_form', JSON.stringify({
        firstName, lastName, dob, gender, phone, email, county, town, step
      }))
    } catch {}
  }, [firstName, lastName, dob, gender, phone, email, county, town, step])

  function toggleArr(arr: string[], val: string, set: (a: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function handleUpload(name: string, hasFile: boolean) {
    setUploads(u => ({ ...u, [name]: hasFile }))
  }

  // ── Validate each step ──
  function validate(): string[] {
    const errs: string[] = []
    if (step === 0) {
      if (!firstName.trim()) errs.push('First name is required.')
      if (!lastName.trim()) errs.push('Last name is required.')
      if (!dob) errs.push('Date of birth is required.')
      else if (!checkAge(dob)) errs.push('You must be at least 21 years old to apply.')
      if (!gender) errs.push('Gender is required.')
      if (!phone.trim()) errs.push('Phone number is required.')
      else if (countryCode === '+254' && !isValidKenyanNumber(phone)) errs.push('Enter a valid Kenyan phone number (e.g. 07xx or 011x).')
      if (!email.trim()) errs.push('Email is required.')
      else if (!/\S+@\S+\.\S+/.test(email)) errs.push('Enter a valid email address.')
      if (!county.trim()) errs.push('County is required.')
      if (!town.trim()) errs.push('Town is required.')
      if (languages.length === 0) errs.push('Select at least one language.')
    }
    if (step === 1) {
      if (!idNumber.trim()) errs.push('National ID number is required.')
      if (!uploads['nationalId']) errs.push('National ID photo is required.')
    }
    if (step === 2) {
      if (!cogcStatus) errs.push('Police clearance status is required.')
    }
    if (step === 3) {
      if (!expYears) errs.push('Years of experience is required.')
      if (ageGroups.length === 0) errs.push('Select at least one age group.')
      if (services.length === 0) errs.push('Select at least one service.')
    }
    if (step === 5) {
      if (!ref1Name.trim()) errs.push('Reference 1 name is required.')
      if (!ref1Phone.trim()) errs.push('Reference 1 phone is required.')
      if (!ref2Name.trim()) errs.push('Reference 2 name is required.')
      if (!ref2Phone.trim()) errs.push('Reference 2 phone is required.')
      if (ref1Email && ref2Email && ref1Email.trim().toLowerCase() === ref2Email.trim().toLowerCase())
        errs.push('Reference emails must be different.')
      if (ref1Phone.trim() === ref2Phone.trim())
        errs.push('Reference phone numbers must be different.')
    }
    if (step === 6) {
      if (availDays.length === 0) errs.push('Select at least one available day.')
      if (!willingTravel) errs.push('Please indicate willingness to travel.')
    }
    if (step === 7) {
      if (!consent1) errs.push('Please consent to background checks.')
      if (!consent2) errs.push('Please consent to data usage.')
      if (!consent3) errs.push('Please confirm the accuracy of your application.')
    }
    return errs
  }

  function goStep(n: number) {
    if (n > step) {
      const errs = validate()
      if (errs.length) { setErrors(errs); return }
    }
    setErrors([])
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submitForm() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    setSubmitting(true)
    const payload = {
      fullName: `${firstName} ${lastName}`,
      dateOfBirth: dob,
      phone,
      countryCode,
      email,
      gender,
      languages,
      county,
      town,
      nationalIdNumber: idNumber,
      kraPin,
      cogcStatus,
      cogcDate: cogcDate || null,
      experienceYears: expYears,
      ageGroups,
      services,
      bio,
      certifications: certifications.filter(Boolean),
      ref1Name, ref1Relationship: ref1Rel, ref1Phone, ref1Email, ref1Employer, ref1Contact,
      ref2Name, ref2Relationship: ref2Rel, ref2Phone, ref2Email, ref2Employer, ref2Contact,
      availableDays: availDays,
      earliestStart,
      latestEnd,
      willingToTravel: willingTravel,
      preferredLocations: prefLocations,
      comfortablePets: comfortPets,
      comfortableMultiple: comfortMultiple,
    }
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setSubmitted(true)
        sessionStorage.removeItem('vn_nanny_form')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setErrors(['Submission failed. Please try again.'])
      }
    } catch {
      setErrors(['Network error. Please check your connection.'])
    } finally {
      setSubmitting(false)
    }
  }

  const progressPct = (step / (STEPS.length - 1)) * 100

  // ── Tier eligibility ──
  function getTierEligibility() {
    const yrs = parseInt(expYears || '0')
    const hasCert = certifications.some(Boolean)
    const hasCogc = cogcStatus === 'yes'
    const multilingual = languages.length >= 3
    const gold = yrs >= 5 && hasCert && hasCogc && multilingual
    const silver = yrs >= 2 && hasCogc
    return { gold, silver, bronze: true }
  }
  const tiers = getTierEligibility()

  if (submitted) {
    return (
      <>
        <nav className="nav">
          <Link href="/" className="nav-logo">Vacay<em>Nanny</em></Link>
        </nav>
        <div className="success-screen active" style={{ paddingTop: '8rem' }}>
          <div className="success-icon">✅</div>
          <h2>Application Submitted!</h2>
          <p>Thank you, {firstName}! Your application has been received. Our team will review it within 3–5 business days and contact you via email and phone.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Check <strong>{email}</strong> for your confirmation.</p>
          <div className="success-steps">
            <div className="success-step">
              <div className="success-step-num">1</div>
              <p>Application review (3–5 business days)</p>
            </div>
            <div className="success-step">
              <div className="success-step-num">2</div>
              <p>Video or in-person interview</p>
            </div>
            <div className="success-step">
              <div className="success-step-num">3</div>
              <p>Background verification &amp; onboarding</p>
            </div>
            <div className="success-step">
              <div className="success-step-num">4</div>
              <p>Profile goes live — start earning!</p>
            </div>
          </div>
          <div style={{ marginTop: '2.5rem' }}>
            <Link href="/" className="btn-coral">Return to Home</Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">Vacay<em>Nanny</em></Link>
        <Link href="/" className="nav-back">← Back to Home</Link>
      </nav>

      {/* HERO */}
      <div className="page-hero">
        <div className="eyebrow">Nanny Application</div>
        <h1>Join the <em>VacayNanny</em> Family</h1>
        <p>Apply to become a vetted holiday childcare professional. Work at Kenya's top resorts, earn premium rates, and build a career you love.</p>
        <div className="tier-badges">
          <div className="tier-badge bronze"><div className="tier-dot" /> Bronze · Entry Level</div>
          <div className="tier-badge silver"><div className="tier-dot" /> Silver · Professional</div>
          <div className="tier-badge gold"><div className="tier-dot" /> Gold · Elite</div>
        </div>
      </div>

      {/* PROGRESS */}
      <div className="progress-wrap">
        <div className="progress-steps">
          <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          {STEPS.map((label, i) => (
            <div
              key={i}
              className={`step-dot-wrap${i === step ? ' active' : ''}`}
              onClick={() => i < step && goStep(i)}
              style={{ cursor: i < step ? 'pointer' : 'default' }}
            >
              <div className={`step-dot${i === step ? ' active' : i < step ? ' done' : ''}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="step-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FORM */}
      <div className="form-container">
        {errors.length > 0 && (
          <div className="step-error">
            <strong>Please fix the following:</strong>
            <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        {/* ── STEP 1: Personal Info ── */}
        {step === 0 && (
          <div className="form-step active">
            <div className="step-header">
              <div className="step-num">Step 1 of 8</div>
              <h2>Personal Information</h2>
              <p>Tell us about yourself. This information helps us match you with the right families.</p>
            </div>
            <div className="form-card">
              <h3>Basic Details</h3>
              <div className="field-row">
                <div className="field">
                  <label>First Name <span className="req">*</span></label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
                </div>
                <div className="field">
                  <label>Last Name <span className="req">*</span></label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Date of Birth <span className="req">*</span></label>
                  <input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                  <span className="field-hint">Must be 21 years or older.</span>
                </div>
                <div className="field">
                  <label>Gender <span className="req">*</span></label>
                  <select value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Select gender</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-card">
              <h3>Contact Details</h3>
              <div className="field-row">
                <div className="field">
                  <label>Phone Number <span className="req">*</span></label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    countryCode={countryCode}
                    onCodeChange={setCountryCode}
                  />
                  <span className="field-hint">Kenyan numbers: 07xx or 011x format</span>
                </div>
                <div className="field">
                  <label>Email Address <span className="req">*</span></label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@email.com" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>County <span className="req">*</span></label>
                  <select value={county} onChange={e => setCounty(e.target.value)}>
                    <option value="">Select county</option>
                    {['Nairobi','Mombasa','Kwale','Kilifi','Tana River','Lamu','Taita-Taveta','Garissa','Wajir','Mandera','Marsabit','Isiolo','Meru','Tharaka-Nithi','Embu','Kitui','Machakos','Makueni','Nyandarua','Nyeri','Kirinyaga','Murang\'a','Kiambu','Turkana','West Pokot','Samburu','Trans-Nzoia','Uasin Gishu','Elgeyo-Marakwet','Nandi','Baringo','Laikipia','Nakuru','Narok','Kajiado','Kericho','Bomet','Kakamega','Vihiga','Bungoma','Busia','Siaya','Kisumu','Homa Bay','Migori','Kisii','Nyamira'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Town / City <span className="req">*</span></label>
                  <input type="text" value={town} onChange={e => setTown(e.target.value)} placeholder="e.g. Diani Beach" />
                </div>
              </div>
            </div>

            <div className="form-card">
              <h3>Languages Spoken</h3>
              <div className="check-grid">
                {['English','Swahili','French','German','Italian','Spanish','Arabic','Chinese (Mandarin)','Sign Language'].map(lang => (
                  <CheckItem
                    key={lang} label={lang}
                    checked={languages.includes(lang)}
                    onChange={v => toggleArr(languages, lang, setLanguages)}
                  />
                ))}
              </div>
            </div>

            <div className="form-card">
              <h3>Brief Bio <span className="optional-tag">Optional</span></h3>
              <div className="field field-row single">
                <label>Tell families about yourself</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Describe your personality, childcare philosophy, and what families can expect from you..."
                  style={{ minHeight: '120px' }}
                />
              </div>
            </div>

            <div className="btn-row">
              <span />
              <button className="btn-primary" onClick={() => goStep(1)}>Next: Identity →</button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Identity ── */}
        {step === 1 && (
          <div className="form-step active">
            <div className="step-header">
              <div className="step-num">Step 2 of 8</div>
              <h2>Identity Verification</h2>
              <p>We verify all nannies to keep families safe. Your documents are stored securely and never shared without your consent.</p>
            </div>

            <div className="info-note">
              <span className="icon">🔒</span>
              All documents are encrypted and stored securely. Used only for verification purposes.
            </div>

            <div className="form-card">
              <h3>Government ID</h3>
              <div className="field-row">
                <div className="field">
                  <label>National ID Number <span className="req">*</span></label>
                  <input type="text" value={idNumber} onChange={e => setIdNumber(e.target.value)} placeholder="e.g. 12345678" />
                </div>
                <div className="field">
                  <label>KRA PIN <span className="optional-tag">Optional</span></label>
                  <input type="text" value={kraPin} onChange={e => setKraPin(e.target.value)} placeholder="A000000000Z" />
                </div>
              </div>
            </div>

            <div className="form-card">
              <h3>Document Uploads</h3>
              <div className="upload-grid">
                <UploadBox
                  name="nationalId" label="Upload National ID (front)"
                  hint="JPG, PNG or PDF · Max 5MB" onFile={handleUpload}
                />
                <UploadBox
                  name="nationalIdBack" label="Upload National ID (back)"
                  hint="JPG, PNG or PDF · Max 5MB" onFile={handleUpload}
                />
              </div>
              <UploadBox
                name="passport" label="Upload Passport Photo Page (optional)"
                hint="Required for Gold-tier international travel nannies" onFile={handleUpload}
              />
            </div>

            <div className="form-card">
              <h3>Headshot Photo <span className="req">*</span></h3>
              <UploadBox
                name="headshot" label="Upload a clear headshot photo"
                hint="JPG or PNG · Professional photo preferred · Max 5MB" onFile={handleUpload}
              />
            </div>

            <div className="btn-row">
              <button className="btn-ghost" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50px', padding: '12px 24px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => goStep(0)}>← Back</button>
              <button className="btn-primary" onClick={() => goStep(2)}>Next: Background →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Background ── */}
        {step === 2 && (
          <div className="form-step active">
            <div className="step-header">
              <div className="step-num">Step 3 of 8</div>
              <h2>Background Check</h2>
              <p>Police clearance is mandatory for all VacayNanny professionals. It protects both you and the families you work with.</p>
            </div>

            <div className="form-card">
              <h3>Certificate of Good Conduct (CoGC)</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', lineHeight: '1.55' }}>
                A CoGC is issued by the Kenya Police Service and is valid for 1 year. You can apply online at <a href="https://www.ecitizen.go.ke" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--coral)' }}>eCitizen</a>.
              </p>
              <div className="radio-cards">
                <RadioCard label="Yes, I have a valid CoGC" selected={cogcStatus === 'yes'} onClick={() => setCogcStatus('yes')} />
                <RadioCard label="Mine is expired — I'm in the process of renewing" selected={cogcStatus === 'renewing'} onClick={() => setCogcStatus('renewing')} />
                <RadioCard label="No, I don't have one yet" selected={cogcStatus === 'no'} onClick={() => setCogcStatus('no')} />
              </div>
              {cogcStatus === 'yes' && (
                <div className="field" style={{ marginTop: '16px' }}>
                  <label>CoGC Issue Date</label>
                  <input type="date" value={cogcDate} onChange={e => setCogcDate(e.target.value)} />
                </div>
              )}
              {(cogcStatus === 'yes' || cogcStatus === 'renewing') && (
                <div style={{ marginTop: '16px' }}>
                  <UploadBox
                    name="cogc" label="Upload your CoGC (optional at this stage)"
                    hint="PDF, JPG or PNG · Max 5MB" onFile={handleUpload}
                  />
                </div>
              )}
              {cogcStatus === 'no' && (
                <div className="info-note" style={{ marginTop: '16px' }}>
                  <span className="icon">ℹ️</span>
                  You can still apply — however you must obtain your CoGC before your first placement. We recommend applying via eCitizen immediately. Cost is approximately KES 1,050.
                </div>
              )}
            </div>

            <div className="btn-row">
              <button className="btn-ghost" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50px', padding: '12px 24px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => goStep(1)}>← Back</button>
              <button className="btn-primary" onClick={() => goStep(3)}>Next: Experience →</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Experience ── */}
        {step === 3 && (
          <div className="form-step active">
            <div className="step-header">
              <div className="step-num">Step 4 of 8</div>
              <h2>Experience & Qualifications</h2>
              <p>Your experience shapes which tier you qualify for. Be accurate — we verify with your references.</p>
            </div>

            <div className="form-card">
              <h3>Experience</h3>
              <div className="field-row">
                <div className="field">
                  <label>Years of Childcare Experience <span className="req">*</span></label>
                  <select value={expYears} onChange={e => setExpYears(e.target.value)}>
                    <option value="">Select</option>
                    <option value="0">Less than 1 year</option>
                    <option value="1">1 year</option>
                    <option value="2">2 years</option>
                    <option value="3">3 years</option>
                    <option value="4">4 years</option>
                    <option value="5">5 years</option>
                    <option value="7">6–9 years</option>
                    <option value="10">10+ years</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-card">
              <h3>Age Groups You Can Care For <span className="req">*</span></h3>
              <div className="check-grid">
                {['Newborns (0–3 months)','Infants (3–12 months)','Toddlers (1–3 years)','Pre-schoolers (3–5 years)','School-age (6–10 years)','Pre-teens (11–14 years)','Teenagers (15+)'].map(ag => (
                  <CheckItem
                    key={ag} label={ag}
                    checked={ageGroups.includes(ag)}
                    onChange={() => toggleArr(ageGroups, ag, setAgeGroups)}
                  />
                ))}
              </div>
            </div>

            <div className="form-card">
              <h3>Services You Provide <span className="req">*</span></h3>
              <div className="check-grid">
                {['General childcare','Infant/newborn care','Overnight care','Special needs care','Tutoring / homework help','Meal preparation','Activity coordination','Transport / driving','Swimming supervision','Arts & crafts','Multilingual teaching','Travel nanny (international)'].map(svc => (
                  <CheckItem
                    key={svc} label={svc}
                    checked={services.includes(svc)}
                    onChange={() => toggleArr(services, svc, setServices)}
                  />
                ))}
              </div>
            </div>

            <div className="form-card">
              <h3>Certifications <span className="optional-tag">Optional but recommended</span></h3>
              <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.45)', marginBottom: '16px' }}>Add any childcare, first-aid, or education certificates you hold.</p>
              {certifications.map((cert, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={cert}
                    onChange={e => {
                      const next = [...certifications]; next[i] = e.target.value; setCertifications(next)
                    }}
                    placeholder={`Certificate ${i + 1} name`}
                    style={{ flex: 1 }}
                  />
                  {certifications.length > 1 && (
                    <button
                      onClick={() => setCertifications(certifications.filter((_, j) => j !== i))}
                      style={{ background: 'rgba(220,60,60,0.15)', border: '1px solid rgba(220,60,60,0.3)', color: '#ff8a8a', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >✕</button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCertifications([...certifications, ''])}
                style={{ background: 'rgba(232,113,74,0.1)', border: '1px solid rgba(232,113,74,0.25)', color: 'var(--coral)', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '0.83rem', marginTop: '4px', fontFamily: 'DM Sans, sans-serif' }}
              >+ Add Certificate</button>
              {certifications.some(Boolean) && (
                <div style={{ marginTop: '16px' }}>
                  <UploadBox
                    name="certs" label="Upload certificate documents"
                    hint="You can upload a single PDF with all certificates" onFile={handleUpload}
                  />
                </div>
              )}
            </div>

            <div className="btn-row">
              <button className="btn-ghost" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50px', padding: '12px 24px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => goStep(2)}>← Back</button>
              <button className="btn-primary" onClick={() => goStep(4)}>Next: Skills →</button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Skills ── */}
        {step === 4 && (
          <div className="form-step active">
            <div className="step-header">
              <div className="step-num">Step 5 of 8</div>
              <h2>Skills & Abilities</h2>
              <p>Help families know exactly what you bring to their holiday.</p>
            </div>

            <div className="form-card">
              <h3>Swimming</h3>
              <div className="radio-cards">
                <RadioCard label="I cannot swim" selected={swimming === 'none'} onClick={() => setSwimming('none')} />
                <RadioCard label="I can swim (basic)" selected={swimming === 'basic'} onClick={() => setSwimming('basic')} />
                <RadioCard label="Strong swimmer — comfortable supervising children in pools/ocean" selected={swimming === 'strong'} onClick={() => setSwimming('strong')} />
                <RadioCard label="Certified lifeguard" selected={swimming === 'lifeguard'} onClick={() => setSwimming('lifeguard')} />
              </div>
            </div>

            <div className="form-card">
              <h3>Cooking for Children</h3>
              <div className="radio-cards">
                <RadioCard label="Basic meal prep (simple dishes, reheating)" selected={cooking === 'basic'} onClick={() => setCooking('basic')} />
                <RadioCard label="Good cook — can prepare balanced children's meals" selected={cooking === 'good'} onClick={() => setCooking('good')} />
                <RadioCard label="Experienced — including dietary restrictions &amp; allergies" selected={cooking === 'experienced'} onClick={() => setCooking('experienced')} />
              </div>
            </div>

            <div className="form-card">
              <h3>Tutoring / Educational Support</h3>
              <div className="radio-cards">
                <RadioCard label="Not applicable" selected={tutoring === 'none'} onClick={() => setTutoring('none')} />
                <RadioCard label="Basic homework help (primary school)" selected={tutoring === 'basic'} onClick={() => setTutoring('basic')} />
                <RadioCard label="Secondary school tutoring" selected={tutoring === 'secondary'} onClick={() => setTutoring('secondary')} />
                <RadioCard label="Montessori / early childhood education trained" selected={tutoring === 'montessori'} onClick={() => setTutoring('montessori')} />
              </div>
            </div>

            <div className="form-card">
              <h3>Driving</h3>
              <div className="radio-cards">
                <RadioCard label="I don't drive" selected={driving === 'none'} onClick={() => setDriving('none')} />
                <RadioCard label="I hold a valid Kenyan driver's licence" selected={driving === 'kenya'} onClick={() => setDriving('kenya')} />
                <RadioCard label="I hold an international driver's licence" selected={driving === 'international'} onClick={() => setDriving('international')} />
              </div>
            </div>

            <div className="form-card">
              <h3>Special Needs Experience</h3>
              <div className="radio-cards">
                <RadioCard label="No specific experience" selected={specialNeeds === 'none'} onClick={() => setSpecialNeeds('none')} />
                <RadioCard label="Some exposure (autism-friendly approaches)" selected={specialNeeds === 'some'} onClick={() => setSpecialNeeds('some')} />
                <RadioCard label="Trained — worked with children with disabilities" selected={specialNeeds === 'trained'} onClick={() => setSpecialNeeds('trained')} />
                <RadioCard label="Certified special needs educator / therapist" selected={specialNeeds === 'certified'} onClick={() => setSpecialNeeds('certified')} />
              </div>
            </div>

            {/* Tier eligibility preview */}
            <div className="form-card">
              <h3>Your Likely Tier Based on Application</h3>
              <div className="tier-cards">
                <div className={`tier-card bronze${tiers.bronze ? '' : ''}`}>
                  <div className="tier-card-label">Bronze</div>
                  <h4>Entry Level</h4>
                  <div className="tier-req"><span className="dot">•</span> Any experience level</div>
                  <div className="tier-req"><span className="dot">•</span> Valid national ID</div>
                  <div className="tier-req"><span className="dot">•</span> CoGC (can apply later)</div>
                  <div className={`tier-eligible-badge${tiers.bronze ? ' show' : ''}`}>Eligible ✓</div>
                </div>
                <div className={`tier-card silver`}>
                  <div className="tier-card-label">Silver</div>
                  <h4>Professional</h4>
                  <div className="tier-req"><span className="dot">•</span> 2+ years experience</div>
                  <div className="tier-req"><span className="dot">•</span> Valid CoGC</div>
                  <div className="tier-req"><span className="dot">•</span> First-aid certified</div>
                  <div className={`tier-eligible-badge${tiers.silver ? ' show' : ''}`}>Eligible ✓</div>
                </div>
                <div className={`tier-card gold`}>
                  <div className="tier-card-label">Gold</div>
                  <h4>Elite</h4>
                  <div className="tier-req"><span className="dot">•</span> 5+ years experience</div>
                  <div className="tier-req"><span className="dot">•</span> 3+ languages</div>
                  <div className="tier-req"><span className="dot">•</span> Passport holder</div>
                  <div className={`tier-eligible-badge${tiers.gold ? ' show' : ''}`}>Eligible ✓</div>
                </div>
              </div>
            </div>

            <div className="btn-row">
              <button className="btn-ghost" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50px', padding: '12px 24px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => goStep(3)}>← Back</button>
              <button className="btn-primary" onClick={() => goStep(5)}>Next: References →</button>
            </div>
          </div>
        )}

        {/* ── STEP 6: References ── */}
        {step === 5 && (
          <div className="form-step active">
            <div className="step-header">
              <div className="step-num">Step 6 of 8</div>
              <h2>Professional References</h2>
              <p>Provide two references who can speak to your childcare experience and character. They must be reachable by phone or email.</p>
            </div>

            <div className="reference-block">
              <h4>Reference 1</h4>
              <div className="field-row">
                <div className="field">
                  <label>Full Name <span className="req">*</span></label>
                  <input type="text" value={ref1Name} onChange={e => setRef1Name(e.target.value)} placeholder="e.g. Mary Kamau" />
                </div>
                <div className="field">
                  <label>Relationship to You <span className="req">*</span></label>
                  <select value={ref1Rel} onChange={e => setRef1Rel(e.target.value)}>
                    <option value="">Select</option>
                    <option>Former Employer</option>
                    <option>Supervisor</option>
                    <option>Colleague</option>
                    <option>Family Friend</option>
                    <option>Teacher / Trainer</option>
                    <option>Other Professional</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Employer / Organisation</label>
                  <input type="text" value={ref1Employer} onChange={e => setRef1Employer(e.target.value)} placeholder="Where they work" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Phone Number <span className="req">*</span></label>
                  <PhoneInput value={ref1Phone} onChange={setRef1Phone} countryCode={ref1Contact} onCodeChange={setRef1Contact} />
                </div>
                <div className="field">
                  <label>Email Address <span className="optional-tag">Optional</span></label>
                  <input type="email" value={ref1Email} onChange={e => setRef1Email(e.target.value)} placeholder="ref@email.com" />
                </div>
              </div>
            </div>

            <div className="reference-block">
              <h4>Reference 2</h4>
              <div className="field-row">
                <div className="field">
                  <label>Full Name <span className="req">*</span></label>
                  <input type="text" value={ref2Name} onChange={e => setRef2Name(e.target.value)} placeholder="e.g. James Odhiambo" />
                </div>
                <div className="field">
                  <label>Relationship to You <span className="req">*</span></label>
                  <select value={ref2Rel} onChange={e => setRef2Rel(e.target.value)}>
                    <option value="">Select</option>
                    <option>Former Employer</option>
                    <option>Supervisor</option>
                    <option>Colleague</option>
                    <option>Family Friend</option>
                    <option>Teacher / Trainer</option>
                    <option>Other Professional</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Employer / Organisation</label>
                  <input type="text" value={ref2Employer} onChange={e => setRef2Employer(e.target.value)} placeholder="Where they work" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Phone Number <span className="req">*</span></label>
                  <PhoneInput value={ref2Phone} onChange={setRef2Phone} countryCode={ref2Contact} onCodeChange={setRef2Contact} />
                </div>
                <div className="field">
                  <label>Email Address <span className="optional-tag">Optional</span></label>
                  <input type="email" value={ref2Email} onChange={e => setRef2Email(e.target.value)} placeholder="ref@email.com" />
                </div>
              </div>
            </div>

            <div className="btn-row">
              <button className="btn-ghost" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50px', padding: '12px 24px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => goStep(4)}>← Back</button>
              <button className="btn-primary" onClick={() => goStep(6)}>Next: Availability →</button>
            </div>
          </div>
        )}

        {/* ── STEP 7: Availability ── */}
        {step === 6 && (
          <div className="form-step active">
            <div className="step-header">
              <div className="step-num">Step 7 of 8</div>
              <h2>Availability & Preferences</h2>
              <p>Tell us when you're available and what kinds of placements you prefer.</p>
            </div>

            <div className="form-card">
              <h3>Available Days <span className="req">*</span></h3>
              <div className="check-grid">
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
                  <CheckItem
                    key={day} label={day}
                    checked={availDays.includes(day)}
                    onChange={() => toggleArr(availDays, day, setAvailDays)}
                  />
                ))}
              </div>
            </div>

            <div className="form-card">
              <h3>Working Hours</h3>
              <div className="field-row">
                <div className="field">
                  <label>Earliest Start Time</label>
                  <input type="time" value={earliestStart} onChange={e => setEarliestStart(e.target.value)} />
                </div>
                <div className="field">
                  <label>Latest End Time</label>
                  <input type="time" value={latestEnd} onChange={e => setLatestEnd(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="form-card">
              <h3>Travel Willingness <span className="req">*</span></h3>
              <div className="radio-cards">
                <RadioCard label="Local only — within my county" selected={willingTravel === 'local'} onClick={() => setWillingTravel('local')} />
                <RadioCard label="Countrywide — anywhere in Kenya" selected={willingTravel === 'kenya'} onClick={() => setWillingTravel('kenya')} />
                <RadioCard label="International — willing to travel abroad with families" selected={willingTravel === 'international'} onClick={() => setWillingTravel('international')} />
              </div>
            </div>

            <div className="form-card">
              <h3>Preferred Locations</h3>
              <p style={{ fontSize: '0.83rem', color: 'rgba(255,255,255,0.45)', marginBottom: '12px' }}>Select destinations you'd love to work in.</p>
              <div className="check-grid">
                {['Diani Beach','Malindi','Watamu','Nairobi','Mombasa','Lamu','Masai Mara','Amboseli','Zanzibar','Anywhere in Kenya'].map(loc => (
                  <CheckItem
                    key={loc} label={loc}
                    checked={prefLocations.includes(loc)}
                    onChange={() => toggleArr(prefLocations, loc, setPrefLocations)}
                  />
                ))}
              </div>
            </div>

            <div className="form-card">
              <h3>Additional Comfort Levels</h3>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>Are you comfortable working in homes with pets?</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['Yes, any pets','Yes, dogs/cats only','No pets','Depends on the pet'].map(opt => (
                    <div
                      key={opt}
                      className={`check-item${comfortPets === opt ? ' checked' : ''}`}
                      style={{ flexBasis: 'calc(50% - 5px)', maxWidth: '260px' }}
                      onClick={() => setComfortPets(opt)}
                    >
                      <div className={`check-box${comfortPets === opt ? ' checked' : ''}`}>{comfortPets === opt ? '✓' : ''}</div>
                      <span className="check-label">{opt}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>Comfortable caring for multiple children simultaneously?</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['Yes — up to 2','Yes — up to 4','Yes — any number','Prefer 1 child'].map(opt => (
                    <div
                      key={opt}
                      className={`check-item${comfortMultiple === opt ? ' checked' : ''}`}
                      style={{ flexBasis: 'calc(50% - 5px)', maxWidth: '260px' }}
                      onClick={() => setComfortMultiple(opt)}
                    >
                      <div className={`check-box${comfortMultiple === opt ? ' checked' : ''}`}>{comfortMultiple === opt ? '✓' : ''}</div>
                      <span className="check-label">{opt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="btn-row">
              <button className="btn-ghost" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50px', padding: '12px 24px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => goStep(5)}>← Back</button>
              <button className="btn-primary" onClick={() => goStep(7)}>Review My Application →</button>
            </div>
          </div>
        )}

        {/* ── STEP 8: Review & Submit ── */}
        {step === 7 && (
          <div className="form-step active">
            <div className="step-header">
              <div className="step-num">Step 8 of 8</div>
              <h2>Review & Submit</h2>
              <p>Please review your details carefully before submitting. You can go back to any step to make changes.</p>
            </div>

            <div className="review-section">
              <h4>Personal Information</h4>
              <div className="review-row"><span className="review-key">Full Name</span><span className="review-val">{firstName} {lastName}</span></div>
              <div className="review-row"><span className="review-key">Date of Birth</span><span className="review-val">{dob}</span></div>
              <div className="review-row"><span className="review-key">Gender</span><span className="review-val">{gender}</span></div>
              <div className="review-row"><span className="review-key">Phone</span><span className="review-val">{countryCode} {phone}</span></div>
              <div className="review-row"><span className="review-key">Email</span><span className="review-val">{email}</span></div>
              <div className="review-row"><span className="review-key">Location</span><span className="review-val">{town}, {county}</span></div>
              <div className="review-row"><span className="review-key">Languages</span><span className="review-val">{languages.join(', ') || '—'}</span></div>
            </div>

            <div className="review-section">
              <h4>Identity & Background</h4>
              <div className="review-row"><span className="review-key">National ID</span><span className="review-val">{idNumber || '—'}</span></div>
              <div className="review-row"><span className="review-key">KRA PIN</span><span className="review-val">{kraPin || '—'}</span></div>
              <div className="review-row"><span className="review-key">Police Clearance</span><span className="review-val">{cogcStatus === 'yes' ? 'Valid CoGC' : cogcStatus === 'renewing' ? 'Renewing' : 'Not yet obtained'}</span></div>
            </div>

            <div className="review-section">
              <h4>Experience & Skills</h4>
              <div className="review-row"><span className="review-key">Years Experience</span><span className="review-val">{expYears ? `${expYears} year(s)` : '—'}</span></div>
              <div className="review-row"><span className="review-key">Age Groups</span><span className="review-val">{ageGroups.join(', ') || '—'}</span></div>
              <div className="review-row"><span className="review-key">Services</span><span className="review-val">{services.join(', ') || '—'}</span></div>
              <div className="review-row"><span className="review-key">Swimming</span><span className="review-val">{swimming || '—'}</span></div>
              <div className="review-row"><span className="review-key">Certifications</span><span className="review-val">{certifications.filter(Boolean).join(', ') || 'None listed'}</span></div>
            </div>

            <div className="review-section">
              <h4>References</h4>
              <div className="review-row"><span className="review-key">Reference 1</span><span className="review-val">{ref1Name} ({ref1Rel})</span></div>
              <div className="review-row"><span className="review-key">Ref 1 Phone</span><span className="review-val">{ref1Contact} {ref1Phone}</span></div>
              <div className="review-row"><span className="review-key">Reference 2</span><span className="review-val">{ref2Name} ({ref2Rel})</span></div>
              <div className="review-row"><span className="review-key">Ref 2 Phone</span><span className="review-val">{ref2Contact} {ref2Phone}</span></div>
            </div>

            <div className="review-section">
              <h4>Availability</h4>
              <div className="review-row"><span className="review-key">Available Days</span><span className="review-val">{availDays.join(', ') || '—'}</span></div>
              <div className="review-row"><span className="review-key">Working Hours</span><span className="review-val">{earliestStart || '—'} – {latestEnd || '—'}</span></div>
              <div className="review-row"><span className="review-key">Travel Willingness</span><span className="review-val">{willingTravel || '—'}</span></div>
              <div className="review-row"><span className="review-key">Preferred Locations</span><span className="review-val">{prefLocations.join(', ') || 'Any'}</span></div>
            </div>

            {/* CONSENTS */}
            <div className="form-card" style={{ marginTop: '24px' }}>
              <h3>Declarations & Consent</h3>
              <div
                className={`consent-item${consent1 ? ' checked' : ''}`}
                onClick={() => setConsent1(c => !c)}
              >
                <div className={`consent-box${consent1 ? ' checked' : ''}`}>{consent1 ? '✓' : ''}</div>
                <span className="consent-text">I consent to VacayNanny conducting background checks, including verification of my police clearance certificate and contacting my references. <span className="req">*</span></span>
              </div>
              <div
                className={`consent-item${consent2 ? ' checked' : ''}`}
                onClick={() => setConsent2(c => !c)}
              >
                <div className={`consent-box${consent2 ? ' checked' : ''}`}>{consent2 ? '✓' : ''}</div>
                <span className="consent-text">I agree to VacayNanny's <a href="#" style={{ color: 'var(--coral)' }}>Terms of Service</a> and <a href="#" style={{ color: 'var(--coral)' }}>Privacy Policy</a>, including the use of my data for matching me with families. <span className="req">*</span></span>
              </div>
              <div
                className={`consent-item${consent3 ? ' checked' : ''}`}
                onClick={() => setConsent3(c => !c)}
              >
                <div className={`consent-box${consent3 ? ' checked' : ''}`}>{consent3 ? '✓' : ''}</div>
                <span className="consent-text">I confirm that all information provided in this application is accurate and truthful to the best of my knowledge. I understand that providing false information may result in immediate disqualification. <span className="req">*</span></span>
              </div>
            </div>

            <div className="btn-row">
              <button className="btn-ghost" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50px', padding: '12px 24px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }} onClick={() => goStep(6)}>← Back</button>
              <button
                className="btn-submit"
                onClick={submitForm}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : 'Submit Application →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
