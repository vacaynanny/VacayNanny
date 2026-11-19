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
  searchParams: Promise<{ checkIn?: string; checkOut?: string; destination?: string; tier?: string; q?: string; infant?: string; cert?: string }>
}) {
  const params = await searchParams
  const [nannies, destinations, busyIds] = await Promise.all([
    getNannies(),
    getDestinations(),
    getBusyNannyIds(params.checkIn, params.checkOut),
  ])
  return (
    <Suspense>
      <NanniesBrowser
        key={JSON.stringify(params)}
        initial={nannies}
        destinations={destinationNames(destinations)}
        kenyaNames={destinations.filter(d => d.country.toLowerCase() === 'kenya').map(d => d.name)}
        busyIds={busyIds}
      />
    </Suspense>
  )
}
