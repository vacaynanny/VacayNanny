export default async function handler() {
  const site = (process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vacaynanny.net').replace(/\/$/, '')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return { statusCode: 204, body: '' }
  }
  const res = await fetch(`${site}/api/cron/bookings`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  return { statusCode: res.status, body: await res.text() }
}

export const config = {
  schedule: '10 * * * *',
}
