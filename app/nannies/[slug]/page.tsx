import { notFound } from 'next/navigation'
import { getNannyBySlug, getReviewsForNanny } from '@/lib/data'
import NannyProfile from './NannyProfile'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const nanny = await getNannyBySlug(slug)
  return {
    title: nanny ? `${nanny.display_name} — VacayNanny` : 'Nanny — VacayNanny',
    description: nanny?.bio || 'Vetted holiday nanny on VacayNanny.',
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const nanny = await getNannyBySlug(slug)
  if (!nanny) notFound()
  const reviews = await getReviewsForNanny(nanny.id)
  return <NannyProfile nanny={nanny} reviews={reviews} />
}
