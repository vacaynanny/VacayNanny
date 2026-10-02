import type { DocumentKind } from '@/lib/types'

export const APPLICATION_FILE_MAX_BYTES = 5 * 1024 * 1024
export const APPLICATION_REQUEST_MAX_BYTES = 40 * 1024 * 1024

const NAMED_FIELDS: { form: string; kind: DocumentKind }[] = [
  { form: 'photo', kind: 'photo' },
  { form: 'id_front', kind: 'id_front' },
  { form: 'id_back', kind: 'id_back' },
  { form: 'selfie', kind: 'selfie' },
  { form: 'cogc', kind: 'cogc' },
  { form: 'passport', kind: 'passport' },
]

type Sniffed = 'jpeg' | 'png' | 'webp' | 'pdf' | 'heic'

export type PreparedApplicationFile = {
  kind: DocumentKind
  buffer: Buffer
  contentType: string
  fileName: string
}

function kindForKey(key: string): DocumentKind | null {
  const named = NAMED_FIELDS.find(field => field.form === key)
  if (named) return named.kind
  if (key === 'certificate' || key === 'certificate_1' || key === 'certificate_2') return 'certificate'
  return null
}

function sniff(buffer: Buffer): Sniffed | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) return 'png'
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp'
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf'
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii')
    if (brand === 'heic' || brand === 'heix' || brand === 'hevc' || brand === 'heif' || brand === 'mif1' || brand === 'msf1') {
      return 'heic'
    }
  }
  return null
}

function contentTypeFor(kind: Sniffed): string {
  switch (kind) {
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'pdf':
      return 'application/pdf'
    case 'heic':
      return 'image/heic'
    default: {
      const _never: never = kind
      return _never
    }
  }
}

function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file'
  const cleaned = base.replace(/[\r\n\0"]/g, '').trim()
  return (cleaned || 'file').slice(0, 120)
}

export function collectApplicationFiles(form: FormData): Map<string, File> | { error: string } {
  const files = new Map<string, File>()
  for (const field of NAMED_FIELDS) {
    const value = form.get(field.form)
    if (value instanceof File && value.size > 0) files.set(field.form, value)
  }
  const certificates = form.getAll('certificate').filter((value): value is File => value instanceof File && value.size > 0)
  if (certificates.length > 3) {
    return { error: 'You can upload up to 3 certificate files.' }
  }
  certificates.forEach((file, index) => {
    files.set(index === 0 ? 'certificate' : `certificate_${index}`, file)
  })
  return files
}

export async function prepareApplicationFiles(
  files: Map<string, File>,
): Promise<{ files: PreparedApplicationFile[] } | { error: string }> {
  if (files.size > 9) return { error: 'Too many files were uploaded.' }
  let total = 0
  const prepared: PreparedApplicationFile[] = []
  for (const [key, file] of files) {
    const kind = kindForKey(key)
    if (!kind) return { error: 'Unexpected upload.' }
    const label = file.name || key
    if (file.size > APPLICATION_FILE_MAX_BYTES) {
      return { error: `${label} must be 5 MB or smaller.` }
    }
    total += file.size
    if (total > APPLICATION_REQUEST_MAX_BYTES) return { error: 'Uploads are too large.' }
    const buffer = Buffer.from(await file.arrayBuffer())
    const sniffed = sniff(buffer)
    if (!sniffed) return { error: `${label} must be a JPG, PNG, WebP, HEIC, or PDF file.` }
    if ((kind === 'photo' || kind === 'selfie') && sniffed === 'pdf') {
      return { error: `${label} must be a JPG, PNG, WebP, or HEIC photo.` }
    }
    prepared.push({
      kind,
      buffer,
      contentType: contentTypeFor(sniffed),
      fileName: safeFileName(file.name),
    })
  }
  return { files: prepared }
}
