'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  SAFEGUARDING_MODULES,
  SAFEGUARDING_PASS_MARK,
  SAFEGUARDING_QUIZ,
} from '@/lib/safeguarding'

export default function SafeguardingModule({ alreadyComplete }: { alreadyComplete: boolean }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>(Array(SAFEGUARDING_QUIZ.length).fill(-1))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [passed, setPassed] = useState(alreadyComplete)

  const inQuiz = step >= SAFEGUARDING_MODULES.length
  const module = !inQuiz ? SAFEGUARDING_MODULES[step] : null

  async function submitQuiz(e: React.FormEvent) {
    e.preventDefault()
    if (answers.some(a => a < 0)) {
      setError('Answer every question to submit.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/nanny/safeguarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not record your result.')
        return
      }
      setPassed(true)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  if (passed) {
    return (
      <div className="form-card">
        <h3>Safeguarding complete</h3>
        <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}>
          You passed the Elite safeguarding module. Your public profile can show the Gold / Elite badge.
        </p>
      </div>
    )
  }

  return (
    <div className="form-card">
      {!inQuiz && module && (
        <>
          <p className="safeguard-step">Module {step + 1} of {SAFEGUARDING_MODULES.length}</p>
          <h3>{module.title}</h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 20 }}>{module.body}</p>
          <div className="booking-actions">
            {step > 0 && (
              <button className="btn-ghost" type="button" onClick={() => setStep(s => s - 1)}>Back</button>
            )}
            <button className="btn-coral" type="button" onClick={() => setStep(s => s + 1)}>
              {step === SAFEGUARDING_MODULES.length - 1 ? 'Start quiz' : 'Next'}
            </button>
          </div>
        </>
      )}
      {inQuiz && (
        <form onSubmit={submitQuiz}>
          <p className="safeguard-step">Quiz · pass {SAFEGUARDING_PASS_MARK}/5</p>
          <h3>Check your understanding</h3>
          {SAFEGUARDING_QUIZ.map((question, qi) => (
            <fieldset key={question.id} className="safeguard-q">
              <legend>{qi + 1}. {question.prompt}</legend>
              {question.options.map((option, oi) => (
                <label key={option}>
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[qi] === oi}
                    onChange={() => setAnswers(list => {
                      const next = [...list]
                      next[qi] = oi
                      return next
                    })}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </fieldset>
          ))}
          {error && <p className="field-error-msg" style={{ marginBottom: 12 }}>{error}</p>}
          <div className="booking-actions">
            <button className="btn-ghost" type="button" onClick={() => setStep(SAFEGUARDING_MODULES.length - 1)}>Back to modules</button>
            <button className="btn-coral" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Submit quiz'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
