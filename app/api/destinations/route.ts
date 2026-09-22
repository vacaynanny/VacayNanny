import { NextResponse } from 'next/server'
import { getDestinations } from '@/lib/data'
import { destinationNames } from '@/lib/destinations'

export const revalidate = 60

export async function GET() {
  const destinations = await getDestinations()
  return NextResponse.json({
    destinations,
    names: destinationNames(destinations),
  })
}
