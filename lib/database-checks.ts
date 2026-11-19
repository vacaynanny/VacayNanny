import { createClient } from '@supabase/supabase-js'
import type { SetupCheck } from './setup-checks'

/** Read-only checks: select zero rows and inspect the Data API's schema document. */
export async function checkDatabase(
  env: Partial<NodeJS.ProcessEnv>,
): Promise<SetupCheck[]> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    return [
      {
        name: 'Supabase schema',
        status: 'pending',
        detail: 'Configure the project URL and server key to inspect its schema.',
      },
    ]
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  })
  const requirements = [
    [
      'Payment ledger',
      'payment_attempts',
      'id,booking_id,reference,amount_subunit,currency,status',
    ],
    [
      'Booking payment fields',
      'bookings',
      'payment_status,paid_at,guest_access_token_hash',
    ],
    [
      'Signed agreements',
      'nanny_applications',
      'agreement_signed_path,agreement_reviewed_at,agreement_reviewed_by,approval_email_sent_at,submission_key,vetting_checks,decision_version',
    ],
    ['Booking workflow', 'bookings', 'version,match_expires_at'],
    ['Nanny moderation', 'nannies', 'is_suspended,suspension_reason'],
    ['Care team assignments', 'booking_assignments', 'booking_id,slot,nanny_id,response'],
    ['Care reservations', 'booking_care_slots', 'booking_id,nanny_id,care_date'],
    [
      'Specialist quotes',
      'contact_messages',
      'care_service,care_status,assigned_to,quote_version,quote_expires_at',
    ],
    ['Notification queue', 'workflow_jobs', 'kind,status,available_at,lease_token'],
    ['Operations follow-ups', 'ops_tasks', 'kind,status,assigned_to'],
  ]
  const checks = await Promise.all(
    requirements.map(async ([name, table, columns]): Promise<SetupCheck> => {
      try {
        const { error } = await db.from(table).select(columns).limit(0)
        return {
          name,
          status: error ? 'pending' : 'ready',
          detail: error
            ? 'The required schema is missing or inaccessible; review the migration and server permissions.'
            : 'Required columns are accessible. No records were downloaded.',
        }
      } catch {
        return {
          name,
          status: 'pending',
          detail: 'The database endpoint could not be checked.',
        }
      }
    }),
  )
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/openapi+json',
      },
      signal: AbortSignal.timeout(10000),
    })
    const schema = response.ok ? await response.json() : null
    const present =
      schema?.paths?.['/rpc/create_booking_payment'] &&
      schema?.paths?.['/rpc/settle_booking_payment']
    const workflows = [
      'commit_booking_mutation',
      'save_complete_application',
      'claim_nanny_applications',
      'update_care_enquiry',
      'accept_care_quote',
      'claim_workflow_jobs',
      'run_workflow_automation',
    ].every((name) => schema?.paths?.[`/rpc/${name}`])
    checks.push({
      name: 'Workflow functions',
      status: workflows ? 'ready' : 'pending',
      detail: workflows
        ? 'Workflow functions appear in the server API schema; none were invoked.'
        : 'Workflow functions are missing or inaccessible; verify the coordinated migration.',
    })
    checks.push({
      name: 'Payment functions',
      status: present ? 'ready' : 'pending',
      detail: present
        ? 'Both payment functions appear in the server API schema; neither was invoked.'
        : 'Payment functions are missing, inaccessible, or schema discovery is disabled. Verify through SQL.',
    })
  } catch {
    checks.push({
      name: 'Workflow functions',
      status: 'pending',
      detail: 'The server API schema could not be checked.',
    })
    checks.push({
      name: 'Payment functions',
      status: 'pending',
      detail: 'The server API schema could not be checked.',
    })
  }
  return checks
}
