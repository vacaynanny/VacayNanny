import type { SupabaseClient } from '@supabase/supabase-js'
import { slugify } from '@/lib/constants'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg'])
const MAX_BYTES = 4 * 1024 * 1024

export function imageExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName === 'jpg' || fromName === 'jpeg' || fromName === 'png' || fromName === 'webp') return fromName === 'jpeg' ? 'jpg' : fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export function validateProfileImage(file: File | null): string | null {
  if (!file || file.size <= 0) return null
  if (file.size > MAX_BYTES) return 'Photos must be 4 MB or smaller.'
  if (!ALLOWED_TYPES.has(file.type) && !file.type.startsWith('image/')) {
    return 'Use a JPG, PNG, or WebP photo.'
  }
  return null
}

export async function uploadPublicPhoto(
  supabase: SupabaseClient,
  folder: string,
  file: File,
): Promise<string> {
  const ext = imageExtension(file)
  const path = `${folder}/${slugify(file.name.replace(/\.[^.]+$/, '')) || 'photo'}-${Date.now()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage.from('nanny-photos').upload(path, buf, {
    contentType: file.type || 'image/jpeg',
    upsert: true,
  })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('nanny-photos').getPublicUrl(path)
  return data.publicUrl
}
