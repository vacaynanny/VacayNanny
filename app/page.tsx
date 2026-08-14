import HomePage from '@/components/HomePage'
import { getDestinations, getNannies, getReviews } from '@/lib/data'

export default async function Page() {
  const [nannies, destinations, reviews] = await Promise.all([
    getNannies(),
    getDestinations(),
    getReviews(),
  ])
  return <HomePage nannies={nannies} destinations={destinations} reviews={reviews} />
}
