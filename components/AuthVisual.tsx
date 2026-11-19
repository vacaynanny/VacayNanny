import MediaImage from './MediaImage'

export default function AuthVisual() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <MediaImage
        className="auth-background-image"
        src="/images/auth-veranda.webp"
        alt=""
        fill
        sizes="(max-aspect-ratio: 3/2) 150vh, 100vw"
        priority
      />
      <div className="auth-background-wash" />
    </div>
  )
}
