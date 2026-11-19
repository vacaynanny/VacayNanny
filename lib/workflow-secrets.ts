import 'server-only'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto'

function key() {
  const secret =
    process.env.NOTIFICATION_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Notification encryption is not configured.')
  return createHash('sha256').update(secret).digest()
}
/** Private links and email bodies are encrypted before they enter the retry queue. */
export function sealWorkflow(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv)
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ])
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: bytes.toString('base64'),
  }
}
export function openWorkflow<T>(value: { iv: string; tag: string; data: string }): T {
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(value.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'))
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(value.data, 'base64')),
      decipher.final(),
    ]).toString('utf8'),
  ) as T
}

export function careLinkToken(id: string) {
  return createHmac('sha256', key()).update(`care-enquiry:${id}`).digest('hex')
}
