'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export default function SignOutButton() {
  const router = useRouter()
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        const supabase = createSupabaseBrowser()
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
