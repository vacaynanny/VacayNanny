'use client'

import { createContext, useContext } from 'react'
import { emptyCatalog, type SiteCatalog } from '@/lib/catalog'

const CatalogContext = createContext<SiteCatalog>(emptyCatalog())

export function SiteCatalogProvider({
  catalog,
  children,
}: {
  catalog: SiteCatalog
  children: React.ReactNode
}) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
}

export function useSiteCatalog() {
  return useContext(CatalogContext)
}
