import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SITE_URL } from '@/lib/constants'
import { SiteCatalogProvider } from '@/components/SiteCatalogProvider'
import { getSiteCatalog } from '@/lib/catalog-data'
import './globals.css'
import './auth.css'
import './responsive.css'
import React from 'react'

const dmSans = localFont({
  src: './fonts/dm-sans-latin-standard-normal.woff2',
  weight: '100 1000',
  variable: '--font-dm-sans',
  display: 'swap',
  adjustFontFallback: 'Arial',
})

const playfair = localFont({
  src: [
    {
      path: './fonts/playfair-display-latin-wght-normal.woff2',
      weight: '400 900',
      style: 'normal',
    },
    {
      path: './fonts/playfair-display-latin-wght-italic.woff2',
      weight: '400 900',
      style: 'italic',
    },
  ],
  variable: '--font-playfair',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'VacayNanny — A holiday that feels like a holiday',
  description:
    'Professional, vetted nannies for your family vacations in Kenya and beyond.',
  openGraph: {
    title: 'VacayNanny — A holiday that feels like a holiday',
    description: 'Thoughtful childcare for your family’s time away.',
    siteName: 'VacayNanny',
    type: 'website',
    locale: 'en_KE',
    images: [
      { url: '/images/holiday-coast.jpg', alt: 'Family time beside the sea' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VacayNanny — A holiday that feels like a holiday',
    images: ['/images/holiday-coast.jpg'],
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/favicon.svg' }],
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const catalog = await getSiteCatalog()
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${dmSans.variable} ${playfair.variable}`}
    >
      <body className={dmSans.className}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <SiteCatalogProvider catalog={catalog}>{children}</SiteCatalogProvider>
      </body>
    </html>
  )
}
