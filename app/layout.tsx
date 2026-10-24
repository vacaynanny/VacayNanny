import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SITE_URL } from '@/lib/constants'
import { SiteCatalogProvider } from '@/components/SiteCatalogProvider'
import { getSiteCatalog } from '@/lib/catalog-data'
import './globals.css'
import React from "react";

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
  title: 'VacayNanny — Premium Holiday Childcare',
  description: 'Professional, vetted nannies for your family vacations in Kenya and beyond.',
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
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className={dmSans.className}>
        <SiteCatalogProvider catalog={catalog}>{children}</SiteCatalogProvider>
      </body>
    </html>
  )
}
