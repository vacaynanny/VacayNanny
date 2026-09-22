import { Suspense } from 'react'
import { getDestinations, getNannies } from '@/lib/data'
import { getBusyNannyIds } from '@/lib/availability'
import { destinationNames } from '@/lib/destinations'
import NanniesBrowser from '@/components/NanniesBrowser'

export const metadata = {
  title: 'Find a Nanny — VacayNanny',
  description: 'Browse vetted holiday nannies across Kenya and beyond. Filter by infant care, first aid, and dates.',
}

export const revalidate = 60

export default async function NanniesPage({
  searchParams,
}: {
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>
}) {
  const params = await searchParams
  const [nannies, destinations, busyIds] = await Promise.all([
    getNannies(),
    getDestinations(),
    getBusyNannyIds(params.checkIn, params.checkOut),
  ])
  return (
    <Suspense>
      <NanniesBrowser initial={nannies} destinations={destinationNames(destinations)} busyIds={busyIds} />
    </Suspense>
  )
}
