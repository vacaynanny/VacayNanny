import { createHmac, timingSafeEqual } from 'node:crypto'

export type PaymentStatus =
  | 'unpaid'
  | 'paid'
  | 'not_required'
  | 'refund_pending'
  | 'refunded'

export function kesToSubunits(value: number): number {
  const amount = Math.round(value * 100)
  if (!Number.isFinite(value) || value < 3 || !Number.isSafeInteger(amount))
    throw new Error('A valid KES amount of at least 3 is required.')
  return amount
}

export function paymentMatches(
  attempt: { reference: string; amount_subunit: number; currency: string },
  transaction: {
    reference?: unknown
    amount?: unknown
    currency?: unknown
    status?: unknown
  },
) {
  return (
    transaction.status === 'success' &&
    transaction.reference === attempt.reference &&
    transaction.amount === attempt.amount_subunit &&
    transaction.currency === attempt.currency
  )
}

function matchesHex(expected: Buffer, actual: string) {
  return (
    /^[0-9a-f]{128}$/.test(actual) &&
    timingSafeEqual(expected, Buffer.from(actual, 'hex'))
  )
}

/** Prefer the timestamped signature. When configured, never downgrade to legacy. */
export function verifyWebhook(
  raw: Buffer,
  headers: Headers,
  secretKey: string,
  webhookSecret?: string,
  now = Math.floor(Date.now() / 1000),
) {
  if (webhookSecret) {
    const parts = (headers.get('paystack-signature') || '')
      .split(',')
      .map((part) => part.trim())
    const times = parts.filter((part) => part.startsWith('t='))
    if (times.length !== 1 || !/^t=\d+$/.test(times[0])) return false
    const timestamp = times[0].slice(2)
    if (Math.abs(now - Number(timestamp)) > 300) return false
    const expected = createHmac('sha512', webhookSecret)
      .update(timestamp + '.')
      .update(raw)
      .digest()
    return parts
      .filter((part) => part.startsWith('v1='))
      .some((part) => {
        const value = part.slice(3)
        const colon = value.indexOf(':')
        return (
          colon > 0 &&
          value.startsWith('whk_') &&
          matchesHex(expected, value.slice(colon + 1))
        )
      })
  }
  if (!secretKey) return false
  return matchesHex(
    createHmac('sha512', secretKey).update(raw).digest(),
    headers.get('x-paystack-signature') || '',
  )
}
