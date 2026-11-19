'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export type OpsTask = {
  id: string
  kind: string
  summary: string
  status: 'open' | 'acknowledged' | 'resolved'
  assigned_to: string | null
  created_at: string
  booking_id: string | null
}
export type FailedJob = {
  id: string
  kind: string
  status: string
  attempts: number
  last_error: string | null
  created_at: string
}
export default function AdminWorkflowTasks({
  tasks,
  failedJobs,
  onOpenBooking,
}: {
  tasks: OpsTask[]
  failedJobs: FailedJob[]
  onOpenBooking: (id: string) => void
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('')
  async function update(id: string, body: Record<string, unknown>) {
    setBusy(id)
    setError('')
    try {
      const response = await fetch(`/api/admin/workflow/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) setError(data.error)
      else router.refresh()
    } catch {
      setError('Could not update this follow-up. Please retry.')
    } finally {
      setBusy('')
    }
  }
  return (
    <section className="ops-stack">
      <h2>Operations follow-ups</h2>
      <p>
        Expired proposals, replacement deadlines, suspensions and failed notifications
        appear here.
      </p>
      {error && (
        <p role="alert" className="field-error-msg">
          {error}
        </p>
      )}
      {!tasks.some((t) => t.status !== 'resolved') && <p>No open follow-ups.</p>}
      {tasks
        .filter((task) => task.status !== 'resolved')
        .map((task) => (
          <article className="ops-card" key={task.id}>
            <span className="ops-pill">{task.status}</span>
            <h3>{task.kind.replaceAll('_', ' ')}</h3>
            <p>{task.summary}</p>
            <p>{task.assigned_to ? 'Assigned to an operator' : 'Unassigned'}</p>
            {task.booking_id && <p>Booking reference: {task.booking_id.slice(0, 8)}</p>}
            <div className="booking-actions">
              {task.booking_id && (
                <button
                  className="btn-ghost"
                  onClick={() => onOpenBooking(task.booking_id!)}
                >
                  Open booking
                </button>
              )}
              <button
                className="btn-ghost"
                disabled={busy === task.id}
                onClick={() => update(task.id, { kind: 'task', status: 'acknowledged' })}
              >
                Take follow-up
              </button>
              <button
                className="btn-coral"
                disabled={busy === task.id}
                onClick={() => update(task.id, { kind: 'task', status: 'resolved' })}
              >
                Mark resolved
              </button>
            </div>
          </article>
        ))}
      {failedJobs.map((job) => (
        <article className="ops-card" key={job.id}>
          <h3>Notification needs attention</h3>
          <p>
            {job.kind} · {job.attempts} attempts
          </p>
          <p>{job.last_error}</p>
          <button
            className="btn-ghost"
            disabled={busy === job.id}
            onClick={() => {
              if (
                window.confirm(
                  'Check the provider delivery log first. Retry only if this notification was not delivered.',
                )
              )
                void update(job.id, { kind: 'job', confirmedNotDelivered: true })
            }}
          >
            Retry after checking delivery
          </button>
        </article>
      ))}
    </section>
  )
}
