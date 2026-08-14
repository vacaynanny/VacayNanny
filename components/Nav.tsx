'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { hasSupabaseConfig } from '@/lib/supabase'

type NavProps = {
  onBook?: () => void
}

export default function Nav({ onBook }: NavProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 40) }
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig()) return
    const supabase = createSupabaseBrowser()
    supabase.auth.getUser().then(async ({ data }) => {
      setSignedIn(!!data.user)
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
        setRole(profile?.role ?? 'parent')
      }
    }).catch(() => {})
  }, [pathname])

  const hash = (id: string) => (pathname === '/' ? `#${id}` : `/#${id}`)
  const accountHref = role === 'admin' ? '/admin' : role === 'nanny' ? '/nanny' : '/account'

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
        {signedIn ? (
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
