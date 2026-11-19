import { NextRequest, NextResponse } from 'next/server'
import { requireAdminProfile } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdminProfile()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params,
    body = await request.json().catch(() => ({})),
    db = createServerClient()
  if (body.kind === 'task' && ['acknowledged', 'resolved'].includes(body.status)) {
    const { data, error } = await db
      .from('ops_tasks')
      .update({
        status: body.status,
        assigned_to: admin.id,
        resolved_at: body.status === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .neq('status', 'resolved')
      .select('id')
      .maybeSingle()
    if (error || !data)
      return NextResponse.json(
        { error: 'This follow-up changed or was already resolved.' },
        { status: 409 },
      )
  } else if (body.kind === 'job' && body.confirmedNotDelivered === true) {
    const { data, error } = await db
      .from('workflow_jobs')
      .update({
        status: 'pending',
        attempts: 0,
        available_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', id)
      .eq('status', 'failed')
      .select('id')
      .maybeSingle()
    if (error || !data)
      return NextResponse.json(
        { error: 'Only a failed notification can be retried.' },
        { status: 409 },
      )
  } else
    return NextResponse.json(
      { error: 'Choose a valid follow-up action.' },
      { status: 400 },
    )
  await db.from('workflow_audit').insert({
    actor_id: admin.id,
    entity_type: body.kind === 'job' ? 'notification' : 'ops_task',
    entity_id: id,
    action: body.kind === 'job' ? 'retry' : body.status,
  })
  return NextResponse.json({ success: true })
}
