'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import MediaImage from './MediaImage'
import styles from './ImageSlideshow.module.css'

type Slide = { src: string; position?: string }

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
function readMotion() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
function readVisibility() {
  return document.visibilityState === 'visible'
}
const serverSnapshot = () => false

/** Decorative scenes crossfade without changing the page's text or layout. */
export default function ImageSlideshow({
  slides,
  label,
  sizes,
  priority = false,
}: {
  slides: readonly Slide[]
  label: string
  sizes: string
  priority?: boolean
}) {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState<ReadonlySet<number>>(() => new Set())
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set())
  const [inView, setInView] = useState(false)
  const [paused, setPaused] = useState(false)
  const motionAllowed = useSyncExternalStore(subscribeMotion, readMotion, serverSnapshot)
  const pageVisible = useSyncExternalStore(subscribeVisibility, readVisibility, serverSnapshot)
  const count = slides.length
  const current = motionAllowed ? active : 0
  const displayed = failed.has(current) ? [...ready][0] ?? current : current
  const playing = motionAllowed && pageVisible && inView && !paused && ready.size > 1

  useEffect(() => {
    const element = root.current
    if (!element || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(entries => {
      setInView(entries.some(entry => entry.isIntersecting))
    }, { threshold: 0.05 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setActive(previous => {
        for (let offset = 1; offset < count; offset++) {
          const next = (previous + offset) % count
          if (ready.has(next)) return next
        }
        return previous
      })
    }, 7000)
    return () => window.clearInterval(timer)
  }, [playing, ready, count])

  return (
    <div ref={root} className={styles.root} role="group" aria-roledescription="slideshow" aria-label={label} aria-live="off" data-playing={playing}>
      <div className={styles.canvas} aria-hidden="true">
        {slides.map((slide, index) => (
          <div className={`${styles.frame} ${index === displayed ? styles.active : ''}`} key={slide.src}>
            <MediaImage
              src={slide.src}
              alt=""
              fill
              sizes={sizes}
              priority={priority && index === 0}
              style={{ objectFit: 'cover', objectPosition: `var(--slideshow-position, ${slide.position || 'center'})` }}
              onLoad={() => setReady(previous => new Set(previous).add(index))}
              onError={() => setFailed(previous => new Set(previous).add(index))}
            />
          </div>
        ))}
      </div>
      {motionAllowed && count > 1 && (
        <button className={styles.pause} type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Resume image slideshow' : 'Pause image slideshow'}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            {paused ? <path d="M4 2.5v11l9-5.5Z" /> : <path d="M4 3h3v10H4Zm5 0h3v10H9Z" />}
          </svg>
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>
      )}
    </div>
  )
}
