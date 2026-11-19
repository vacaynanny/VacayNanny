'use client'

import { useEffect, useRef } from 'react'

/** Content stays visible without JavaScript; animate once on entering view. */
export default function Reveal({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (
      !element ||
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.animate(
            [
              { opacity: 0, transform: 'translateY(20px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ],
            {
              duration: 650,
              easing: 'cubic-bezier(.2,.7,.2,1)',
            },
          )
          observer.disconnect()
        }
      },
      { threshold: 0.08 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  )
}
