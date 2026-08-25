import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED: Record<string, string[]> = {
  '/account': ['parent', 'admin'],
  '/nanny': ['nanny', 'admin'],
  '/admin': ['admin'],
}

const AUTH_MS = 1500

function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(c =>
    c.name.includes('auth-token') || c.name.startsWith('sb-'),
  )
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<null>(resolve => {
        timer = setTimeout(() => resolve(null), ms)
      }),
    ])
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()

  const path = request.nextUrl.pathname
  const isAuthPage = path === '/login' || path === '/signup'
  const gate = Object.entries(PROTECTED).find(
    ([prefix]) => path === prefix || path.startsWith(prefix + '/'),
  )

  // No session cookie → skip network. Login/signup stay instant.
  if (!hasAuthCookie(request)) {
    if (gate) {
      const login = request.nextUrl.clone()
      login.pathname = '/login'
      login.searchParams.set('next', path)
      return NextResponse.redirect(login)
    }
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const authResult = await withTimeout(supabase.auth.getUser(), AUTH_MS)
  const user = authResult?.data?.user ?? null

  if (gate) {
    if (!user) {
      const login = request.nextUrl.clone()
      login.pathname = '/login'
      login.searchParams.set('next', path)
      return NextResponse.redirect(login)
    }
    const profileResult = await withTimeout(
      supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      AUTH_MS,
    )
    const role = profileResult?.data?.role || 'parent'
    if (!gate[1].includes(role)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/account', request.url))
  }

  return response
}

export const config = {
  matcher: ['/account/:path*', '/nanny/:path*', '/admin/:path*', '/login', '/signup'],
}
