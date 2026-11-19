export const SPECIALIST_SERVICES = [
  'Specialised Childcare',
  'Adult & Elderly Care',
  'Professional Nursing Care',
] as const
export type CareStatus =
  | 'new'
  | 'assessing'
  | 'quoted'
  | 'accepted'
  | 'fulfilled'
  | 'closed'
export type CareEnquiry = {
  id: string
  name: string
  email: string
  subject: string | null
  message: string
  created_at: string
  care_service?: string | null
  care_status?: CareStatus
  assigned_to?: string | null
  assessment_notes?: string | null
  quote_summary?: string | null
  quote_amount_kes?: number | null
  quote_expires_at?: string | null
  quoted_at?: string | null
  accepted_at?: string | null
  quote_version?: number
  provider_details?: string | null
  service_start?: string | null
  service_end?: string | null
  family_id?: string | null
  guest_access_token_hash?: string | null
}
export type FamilyCareEnquiry = Pick<
  CareEnquiry,
  | 'id'
  | 'name'
  | 'care_service'
  | 'care_status'
  | 'quote_summary'
  | 'quote_amount_kes'
  | 'quote_expires_at'
  | 'quoted_at'
  | 'accepted_at'
  | 'quote_version'
  | 'service_start'
  | 'service_end'
>
export const FAMILY_CARE_COLUMNS =
  'id,name,care_service,care_status,quote_summary,quote_amount_kes,quote_expires_at,quoted_at,accepted_at,quote_version,service_start,service_end'
export function familyCareEnquiry(row: CareEnquiry): FamilyCareEnquiry {
  const {
    id,
    name,
    care_service,
    care_status,
    quote_summary,
    quote_amount_kes,
    quote_expires_at,
    quoted_at,
    accepted_at,
    quote_version,
    service_start,
    service_end,
  } = row
  return {
    id,
    name,
    care_service,
    care_status,
    quote_summary,
    quote_amount_kes,
    quote_expires_at,
    quoted_at,
    accepted_at,
    quote_version,
    service_start,
    service_end,
  }
}
