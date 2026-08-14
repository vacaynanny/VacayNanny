'use client'

import Nav from './Nav'
import Footer from './Footer'
import WAFloat from './WAFloat'
import BookingModal, { type BookingDefaults } from './BookingModal'
import { useState } from 'react'

export default function PageShell({
  children,
  bookDefaults,
}: {
  children: React.ReactNode
  bookDefaults?: BookingDefaults
}) {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <>
      <Nav onBook={() => setModalOpen(true)} />
      <div className="site-wrap page-inner">
        {children}
        <Footer />
      </div>
      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} defaults={bookDefaults} />
      <WAFloat />
    </>
  )
}
