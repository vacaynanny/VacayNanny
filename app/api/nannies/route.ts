import { NextResponse } from 'next/server'
import { getNannies } from '@/lib/data'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const nannies = await getNannies({
    destination: searchParams.get('destination') || undefined,
    tier: searchParams.get('tier') || undefined,
    q: searchParams.get('q') || undefined,
    infant: searchParams.get('infant') === '1',
    cert: searchParams.get('cert') || undefined,
  })
  return NextResponse.json({ nannies })
}
