'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BookingMessage, BookingMessageRole } from '@/lib/types'

function roleLabel(role: BookingMessageRole, mine: boolean) {
  if (mine) return 'You'
  switch (role) {
    case 'parent':
      return 'Family'
    case 'nanny':
      return 'Nanny'
    case 'admin':
      return 'VacayNanny'
    default: {
      const _never: never = role
      return _never
    }
  }
}

export default function BookingThread({
  bookingId,
  viewerRole,
  counterpartName,
}: {
  bookingId: string
  viewerRole: BookingMessageRole
  counterpartName?: string
}) {
  const [messages, setMessages] = useState<BookingMessage[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/booking/${bookingId}/messages`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Could not load messages.')
      return
    }
    setError('')
    setMessages((json.messages || []) as BookingMessage[])
  }, [bookingId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    const timer = window.setInterval(() => {
      load().catch(() => {})
    }, 12000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [load])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setSending(true)
    setError('')
    try {
      const res = await fetch(`/api/booking/${bookingId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not send that message.')
        return
      }
      setText('')
      if (json.message) setMessages(list => [...list, json.message as BookingMessage])
      else await load()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="booking-thread">
      <p className="booking-thread-title">
        Messages{counterpartName ? ` with ${counterpartName}` : ''}
      </p>
      <div className="booking-thread-log" ref={scroller}>
        {loading && messages.length === 0 && (
          <p className="booking-thread-empty">Loading thread…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="booking-thread-empty">No messages yet. Share logistics, allergies, or gate codes here — not on WhatsApp.</p>
        )}
        {messages.map(message => {
          const mine = message.sender_role === viewerRole
          return (
            <div key={message.id} className={`booking-bubble${mine ? ' mine' : ''}`}>
              <span>{roleLabel(message.sender_role, mine)}</span>
              <p>{message.body}</p>
            </div>
          )
        })}
      </div>
      {error && <p className="field-error-msg" style={{ marginTop: 10 }}>{error}</p>}
      <form className="booking-thread-form" onSubmit={send}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Write a message…"
          required
        />
        <button className="btn-coral" type="submit" disabled={sending || !text.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
