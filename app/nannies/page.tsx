import { Suspense } from 'react'
import { getDestinations, getNannies } from '@/lib/data'
import { destinationNames } from '@/lib/destinations'
import NanniesBrowser from '@/components/NanniesBrowser'

export const metadata = {
  title: 'Find a Nanny — VacayNanny',
  description: 'Browse vetted holiday nannies across Kenya and beyond.',
}

export const revalidate = 60

export default async function NanniesPage() {
  const [nannies, destinations] = await Promise.all([getNannies(), getDestinations()])
  return (
    <Suspense>
      <NanniesBrowser initial={nannies} destinations={destinationNames(destinations)} />
    </Suspense>
  )
}
