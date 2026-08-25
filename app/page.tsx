import HomePage from '@/components/HomePage'
import { getDestinations, getNannies, getReviews } from '@/lib/data'

// Avoid blocking every visit on fresh Supabase round-trips
export const revalidate = 60

export default async function Page() {
  const [nannies, destinations, reviews] = await Promise.all([
    getNannies(),
    getDestinations(),
    getReviews(),
  ])
  return <HomePage nannies={nannies} destinations={destinations} reviews={reviews} />
}
