import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { openWorkflow } from './workflow-secrets'
import { APPLICATION_FILE_MAX_BYTES } from './application-files'
export type ApplicationUploadEntry = {
  key: string
  kind: string
  bucket: string
  path: string
  name: string
  size: number
  token?: string
}
export type ApplicationUploadManifest = {
  applicationId: string
  expiresAt: number
  payload: Record<string, unknown>
  entries: ApplicationUploadEntry[]
}
export async function readApplicationUpload(
  db: SupabaseClient,
  sealed: Parameters<typeof openWorkflow>[0],
) {
  const manifest = openWorkflow<ApplicationUploadManifest>(sealed)
  if (!manifest || manifest.expiresAt < Date.now() || manifest.entries.length > 9)
    throw new Error('These uploads have expired. Please submit again.')
  const files = new Map<string, File>()
  for (const entry of manifest.entries) {
    if (
      entry.bucket !== 'nanny-documents' ||
      !entry.path.startsWith(`${manifest.applicationId}/`) ||
      entry.size > APPLICATION_FILE_MAX_BYTES
    )
      throw new Error('Invalid upload manifest.')
    const { data, error } = await db.storage.from(entry.bucket).download(entry.path)
    if (error || !data || data.size !== entry.size)
      throw new Error('A document was not uploaded completely. Please submit again.')
    files.set(entry.key, new File([data], entry.name, { type: data.type }))
  }
  return { payload: manifest.payload, files, manifest }
}
