import Image, { type ImageProps } from 'next/image'

type MediaImageProps = Omit<ImageProps, 'src' | 'unoptimized'> & {
  src: string
}

function shouldOptimize(src: string) {
  if (src.startsWith('blob:') || src.startsWith('data:') || src.startsWith('/api/')) return false
  if (src.startsWith('/') && !src.startsWith('//')) return true
  try {
    const url = new URL(src)
    if (url.protocol !== 'https:') return false
    return url.hostname === 'images.unsplash.com' || url.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

export default function MediaImage({ src, alt, ...props }: MediaImageProps) {
  return <Image src={src} alt={alt} unoptimized={!shouldOptimize(src)} {...props} />
}
