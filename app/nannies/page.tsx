import { Suspense } from 'react'
import { getNannies } from '@/lib/data'
import NanniesBrowser from '@/components/NanniesBrowser'

export const metadata = {
  title: 'Find a Nanny — VacayNanny',
  description: 'Browse vetted holiday nannies across Kenya and beyond.',
}

export default async function NanniesPage() {
  const nannies = await getNannies()
  return (
    <Suspense>
      <NanniesBrowser initial={nannies} />
    </Suspense>
  )
}
