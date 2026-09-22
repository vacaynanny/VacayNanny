import type { DocumentKind, NannyDocument } from '@/lib/types'

export const DOCUMENT_KIND_ORDER: DocumentKind[] = [
  'photo',
  'selfie',
  'id_front',
  'id_back',
  'cogc',
  'passport',
  'certificate',
]

export function documentKindLabel(kind: DocumentKind): string {
  switch (kind) {
    case 'photo':
      return 'Profile photo'
    case 'selfie':
      return 'Selfie check'
    case 'id_front':
      return 'National ID (front)'
    case 'id_back':
      return 'National ID (back)'
    case 'cogc':
      return 'Certificate of Good Conduct'
    case 'passport':
      return 'Passport'
    case 'certificate':
      return 'Certificate'
    default: {
      const _never: never = kind
      return _never
    }
  }
}

export function parseStoragePath(storagePath: string): { bucket: string; path: string } {
  const trimmed = storagePath.replace(/^\/+/, '')
  const slash = trimmed.indexOf('/')
  if (slash === -1) return { bucket: 'nanny-documents', path: trimmed }
  const bucket = trimmed.slice(0, slash)
  const path = trimmed.slice(slash + 1)
  if (bucket === 'nanny-photos' || bucket === 'nanny-documents') {
    return { bucket, path }
  }
  return { bucket: 'nanny-documents', path: trimmed }
}

export function isPreviewableImage(doc: Pick<NannyDocument, 'mime_type' | 'file_name' | 'kind'>): boolean {
  const mime = (doc.mime_type || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  const name = (doc.file_name || '').toLowerCase()
  if (/\.(jpe?g|png|webp|gif)$/.test(name)) return true
  return doc.kind === 'photo' || doc.kind === 'selfie' || doc.kind === 'id_front' || doc.kind === 'id_back'
}

export function isPdf(doc: Pick<NannyDocument, 'mime_type' | 'file_name'>): boolean {
  const mime = (doc.mime_type || '').toLowerCase()
  if (mime === 'application/pdf') return true
  return (doc.file_name || '').toLowerCase().endsWith('.pdf')
}

export function sortDocuments(docs: NannyDocument[]): NannyDocument[] {
  return [...docs].sort((a, b) => {
    const ai = DOCUMENT_KIND_ORDER.indexOf(a.kind)
    const bi = DOCUMENT_KIND_ORDER.indexOf(b.kind)
    const aRank = ai === -1 ? DOCUMENT_KIND_ORDER.length : ai
    const bRank = bi === -1 ? DOCUMENT_KIND_ORDER.length : bi
    if (aRank !== bRank) return aRank - bRank
    return (a.file_name || '').localeCompare(b.file_name || '')
  })
}

export function joinList(values?: string[] | null): string {
  return (values || []).filter(Boolean).join(', ') || '—'
}

export function cogcLabel(status?: string | null): string {
  const s = (status || '').toLowerCase()
  if (s === 'yes' || s === 'have') return 'Valid CoGC'
  if (s === 'renewing') return 'Renewing'
  if (s === 'applied' || s === 'pending') return 'Applied / pending'
  if (s === 'no' || s === 'none') return 'Not obtained'
  return status || '—'
}

export function travelLabel(value?: string | null): string {
  switch (value) {
    case 'international':
      return 'International too'
    case 'kenya':
      return 'Anywhere in Kenya'
    case 'county':
      return 'Within county only'
    case 'local':
      return 'Local only'
    default:
      return value || '—'
  }
}

const NAIROBI = 'Africa/Nairobi'

export function toNairobiDatetimeLocal(iso?: string | null): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NAIROBI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || ''
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

export function fromNairobiDatetimeLocal(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const iso = new Date(`${trimmed}:00+03:00`)
  if (Number.isNaN(iso.getTime())) return null
  return iso.toISOString()
}

export function formatNairobiInterview(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-KE', {
    timeZone: NAIROBI,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
