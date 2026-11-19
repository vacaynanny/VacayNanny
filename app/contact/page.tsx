import ContactPage from '@/components/ContactPage'

export const metadata = { title: 'Contact VacayNanny' }
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; destination?: string }>
}) {
  const { service, destination } = await searchParams
  const allowed = [
    'Specialised Childcare',
    'Adult & Elderly Care',
    'Professional Nursing Care',
  ]
  const tripDestination = destination && ['Diani Beach', 'Watamu', 'Nairobi', 'Maasai Mara'].includes(destination) ? destination : ''
  return (
    <ContactPage
      key={`${service || ''}/${tripDestination}`}
      service={service && allowed.includes(service) ? service : ''}
      destination={tripDestination}
    />
  )
}
