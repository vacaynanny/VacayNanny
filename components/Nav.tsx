'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { hasSupabaseConfig } from '@/lib/supabase'

type NavProps = {
  onBook?: () => void
}

function hasClientAuthCookie() {
  if (typeof document === 'undefined') return false
  return document.cookie.split(';').some(c => {
    const n = c.trim()
    return n.startsWith('sb-') || n.includes('auth-token')
  })
}

function subscribeScroll(onStoreChange: () => void) {
  window.addEventListener('scroll', onStoreChange, { passive: true })
  return () => window.removeEventListener('scroll', onStoreChange)
}

function subscribeFocus(onStoreChange: () => void) {
  window.addEventListener('focus', onStoreChange)
  return () => window.removeEventListener('focus', onStoreChange)
}

export default function Nav({ onBook }: NavProps) {
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > 40, () => false)
  const hasCookie = useSyncExternalStore(subscribeFocus, hasClientAuthCookie, () => false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    // Skip network when nobody is signed in — keeps login/signup snappy
    if (!hasSupabaseConfig() || !hasCookie) return
    let cancelled = false
    const supabase = createSupabaseBrowser()
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setSignedIn(false)
        setRole(null)
      }
    }, 2000)

    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return
      window.clearTimeout(timer)
      setSignedIn(!!data.user)
      if (data.user) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()
          if (!cancelled) setRole(profile?.role ?? 'parent')
        } catch {
          if (!cancelled) setRole('parent')
        }
      } else {
        setRole(null)
      }
    }).catch(() => {
      if (!cancelled) {
        window.clearTimeout(timer)
        setSignedIn(false)
        setRole(null)
      }
    })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pathname, hasCookie])

  const showSignedIn = hasCookie && signedIn
  const visibleRole = hasCookie ? role : null
  const hash = (id: string) => (pathname === '/' ? `#${id}` : `/#${id}`)
  const accountHref = visibleRole === 'admin' ? '/admin' : visibleRole === 'nanny' ? '/nanny' : '/account'

  return (
    <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
      <Link href="/" className="nav-logo">Vacay<em>Nanny</em></Link>
      <button
        className="nav-burger"
        aria-label="Menu"
        onClick={() => setMenuOpen(o => !o)}
      >
        {menuOpen ? '✕' : '☰'}
      </button>
      <ul className={`nav-links${menuOpen ? ' open' : ''}`}>
        <li><Link href={hash('how')} onClick={() => setMenuOpen(false)}>How It Works</Link></li>
        <li><Link href="/nannies" onClick={() => setMenuOpen(false)}>Our Nannies</Link></li>
        <li><Link href={hash('pricing')} onClick={() => setMenuOpen(false)}>Pricing</Link></li>
        <li><Link href={hash('destinations')} onClick={() => setMenuOpen(false)}>Destinations</Link></li>
        <li><Link href={hash('faq')} onClick={() => setMenuOpen(false)}>FAQ</Link></li>
        {showSignedIn ? (
          <li><Link href={accountHref} onClick={() => setMenuOpen(false)}>Dashboard</Link></li>
        ) : (
          <li><Link href="/login" onClick={() => setMenuOpen(false)}>Sign in</Link></li>
        )}
      </ul>
      {onBook ? (
        <button className="nav-cta" onClick={onBook}>Book a Nanny</button>
      ) : (
        <Link href="/nannies" className="nav-cta" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          Book a Nanny
        </Link>
      )}
    </nav>
  )
}
