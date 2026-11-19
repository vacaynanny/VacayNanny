'use client'
import Link from 'next/link'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
function bookingPath() {
  try {
    const path = sessionStorage.getItem('vacaynanny:booking-return') || ''
    return /^\/booking\/[0-9a-f-]{36}\?token=[0-9a-f]{64}$/i.test(path)
      ? path
      : '/account'
  } catch {
    return '/account'
  }
}
export default function PaymentReturnLink() {
  const href = useSyncExternalStore(subscribe, bookingPath, () => '/account')
  return (
    <Link href={href} className="btn-coral">
      Return to my booking
    </Link>
  )
}
