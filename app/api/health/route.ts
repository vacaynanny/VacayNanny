export async function GET() {
  return Response.json(
    { service: 'vacaynanny', status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
