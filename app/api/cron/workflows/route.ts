import { NextRequest, NextResponse } from 'next/server'
import { authorizedCron } from '@/lib/cron-auth'
import { createServerClient } from '@/lib/supabase'
import { processWorkflowJobs } from '@/lib/workflow-jobs'
import { advanceDueBookings } from '@/lib/booking-ops'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  if (!authorizedCron(request.headers.get('authorization'), process.env.CRON_SECRET))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const db = createServerClient()
    const { data: expired, error } = await db.rpc('run_workflow_automation')
    if (error) throw error
    let lifecycleFailed = false
    try {
      await advanceDueBookings(db, { strict: true })
    } catch {
      lifecycleFailed = true
    }
    // Domain jobs enqueue individual recipient jobs, which are drained in the same run.
    const first = await processWorkflowJobs(db, 15)
    const second = await processWorkflowJobs(db, 30)
    return NextResponse.json(
      {
        ok: !lifecycleFailed,
        expired,
        processed: first.processed + second.processed,
        failed: first.failed + second.failed,
        disabled: first.disabled,
      },
      { status: lifecycleFailed ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      { error: 'Workflow processing failed. Pending jobs remain queued.' },
      { status: 503 },
    )
  }
}
export const GET = POST
