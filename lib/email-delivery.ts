import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import { Resend } from 'resend'
import { createServerClient } from './supabase'
import { emailSettings } from './email-settings'
import { sealWorkflow } from './workflow-secrets'

export type EmailMessage = {
  from?: string
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  attachments?: { filename: string; content: Buffer }[]
  applicationApprovalId?: string
}
export type StoredEmail = Omit<EmailMessage, 'attachments'> & {
  attachments?: { filename: string; content: string }[]
}
const context = new AsyncLocalStorage<string>()
export function withNotificationContext<T>(key: string, operation: () => Promise<T>) {
  return context.run(key, operation)
}
export async function sendEmail(message: EmailMessage) {
  if (emailSettings().mode === 'disabled')
    return { data: null, error: null, skipped: true, queued: false }
  const payload: StoredEmail = {
    ...message,
    attachments: message.attachments?.map((file) => ({
      ...file,
      content: file.content.toString('base64'),
    })),
  }
  const key = createHash('sha256')
    .update(`${context.getStore() || randomUUID()}:${message.to}:${message.subject}`)
    .digest('hex')
  const { data, error } = await createServerClient().rpc('enqueue_workflow_job', {
    p_kind: 'email',
    p_payload: { sealed: sealWorkflow(payload) },
    p_key: `email:${key}`,
  })
  if (error) throw new Error('Could not queue the email notification.')
  return { data: { id: String(data) }, error: null, skipped: false, queued: true }
}
export async function deliverEmail(stored: StoredEmail, idempotencyKey: string) {
  const settings = emailSettings()
  if (settings.mode !== 'send' || !settings.apiKey)
    throw new Error('Email delivery is not configured.')
  const { applicationApprovalId: _approval, ...message } = stored
  void _approval
  const { error } = await new Resend(settings.apiKey).emails.send(
    {
      ...message,
      from: settings.from,
      replyTo: message.replyTo || settings.replyTo,
      attachments: message.attachments?.map((file) => ({
        ...file,
        content: Buffer.from(file.content, 'base64'),
      })),
    },
    { idempotencyKey },
  )
  if (error) throw new Error('Email provider did not accept the notification.')
}
