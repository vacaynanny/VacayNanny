import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED: Record<string, string[]> = {
  '/account': ['parent', 'admin'],
  '/nanny': ['nanny', 'admin'],
  '/admin': ['admin'],
}

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()

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

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const gate = Object.entries(PROTECTED).find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))
  if (gate) {
    if (!user) {
      const login = request.nextUrl.clone()
      login.pathname = '/login'
      login.searchParams.set('next', path)
      return NextResponse.redirect(login)
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = profile?.role || 'parent'
    if (!gate[1].includes(role)) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (user && (path === '/login' || path === '/signup')) {
    return NextResponse.redirect(new URL('/account', request.url))
  }

  return response
}

export const config = {
  matcher: ['/account/:path*', '/nanny/:path*', '/admin/:path*', '/login', '/signup'],
}
