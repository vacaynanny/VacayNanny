import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function createGuestAccess() {
  const token = randomBytes(32).toString('hex')
  return { token, hash: hashGuestToken(token) }
}
export function hashGuestToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
export function validGuestToken(
  token: string | null | undefined,
  hash: string | null | undefined,
) {
  if (
    !token ||
    !hash ||
    !/^[0-9a-f]{64}$/.test(token) ||
    !/^[0-9a-f]{64}$/.test(hash)
  )
    return false
  return timingSafeEqual(
    Buffer.from(hashGuestToken(token), 'hex'),
    Buffer.from(hash, 'hex'),
  )
}
