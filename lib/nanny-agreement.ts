import 'server-only'
import { emailSettings } from '@/lib/email-settings'
import { createServerClient } from '@/lib/supabase'

export async function loadNannyAgreement() {
  const path = process.env.NANNY_AGREEMENT_STORAGE_PATH
  const delivery = emailSettings()
  if (!path || !delivery.apiKey || delivery.mode !== 'send')
    throw new Error(
      'Configure the official agreement PDF and Resend before sending approval emails.',
    )
  const { data, error } = await createServerClient()
    .storage.from('nanny-documents')
    .download(path)
  if (error || !data)
    throw new Error(
      'The official agreement PDF could not be loaded. Check NANNY_AGREEMENT_STORAGE_PATH.',
    )
  const content = Buffer.from(await data.arrayBuffer())
  if (
    content.length > 8 * 1024 * 1024 ||
    content.subarray(0, 5).toString() !== '%PDF-'
  )
    throw new Error('The official agreement must be a PDF under 8 MB.')
  return {
    filename:
      'VacayNanny-Nanny-Code-of-Conduct-and-Marketplace-Participation-Agreement.pdf',
    content,
  }
}
