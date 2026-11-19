import { timingSafeEqual } from 'node:crypto'

export function authorizedCron(
  header: string | null,
  secret: string | undefined,
) {
  if (!secret || !header) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const supplied = Buffer.from(header)
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  )
}
