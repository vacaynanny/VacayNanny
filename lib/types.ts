export type UserRole = 'parent' | 'nanny' | 'admin'
export type NannyTier = 'bronze' | 'silver' | 'gold'
export type ApplicationStatus = 'pending' | 'reviewing' | 'interview' | 'approved' | 'rejected'
export type BookingStatus = 'pending' | 'matched' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
export type CareType = 'standard' | 'extended' | 'overnight'
export type NannyResponse = 'pending' | 'accepted' | 'declined'
export type DocumentKind =
  | 'photo'
  | 'id_front'
  | 'id_back'
  | 'selfie'
  | 'cogc'
  | 'passport'
  | 'certificate'

export type Profile = {
  id: string
  role: UserRole
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  created_at: string
}

export type Destination = {
  id: string
  slug: string
  name: string
  country: string
  image_url: string | null
  description: string | null
  is_active: boolean
  sort_order: number
}

export type Nanny = {
  id: string
  user_id: string | null
  application_id: string | null
  slug: string
  display_name: string
  photo_url: string | null
  bio: string | null
  tier: NannyTier
  daily_rate_kes: number
  county: string | null
  town: string | null
  destinations: string[]
  languages: string[]
  age_groups: string[]
  services: string[]
  certifications: string[]
  tags: string[]
  available_days: string[]
  willing_to_travel: string | null
  is_active: boolean
  rating_avg: number
  review_count: number
  created_at: string
}

export type Review = {
  id: string
  booking_id?: string | null
  nanny_id: string
  parent_name: string
  trip_label: string | null
  rating: number
  body: string
  avatar_url: string | null
  is_published: boolean
  created_at: string
  nannies?: Pick<Nanny, 'id' | 'display_name' | 'slug'> | null
}

export type Booking = {
  id: string
  parent_id: string | null
  nanny_id: string | null
  parent_name: string
  email: string
  phone: string | null
  destination: string
  check_in: string
  check_out: string
  children_count: string | null
  youngest_age: string | null
  nannies_needed: string
  tier: string | null
  notes: string | null
  status: BookingStatus
  total_amount_kes: number | null
  care_type: CareType
  parent_confirmed_at: string | null
  nanny_response: NannyResponse | null
  nanny_responded_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  refund_percent: number | null
  replacement_requested_at: string | null
  replacement_fulfilled_at: string | null
  replaced_nanny_id: string | null
  created_at: string
  updated_at?: string
  nannies?: Pick<Nanny, 'id' | 'display_name' | 'slug' | 'photo_url' | 'tier' | 'daily_rate_kes'> | null
  review?: Pick<Review, 'id' | 'rating' | 'body' | 'trip_label' | 'is_published' | 'created_at'> | null
}

export type NannyApplication = {
  id: string
  user_id: string | null
  full_name: string
  date_of_birth: string | null
  phone: string | null
  country_code: string | null
  email: string
  gender: string | null
  languages: string[]
  county: string | null
  town: string | null
  national_id_number: string | null
  kra_pin: string | null
  cogc_status: string | null
  cogc_date: string | null
  experience_years: string | null
  age_groups: string[]
  services: string[]
  bio: string | null
  certifications: string[]
  swimming: string | null
  cooking: string | null
  tutoring: string | null
  driving: string | null
  special_needs: string | null
  available_days: string[]
  earliest_start: string | null
  latest_end: string | null
  willing_to_travel: string | null
  preferred_locations: string[]
  comfortable_pets: string | null
  comfortable_multiple: string | null
  estimated_tier: NannyTier
  status: ApplicationStatus
  admin_notes: string | null
  created_at: string
}

export type NannyReference = {
  id: string
  application_id: string
  full_name: string
  relationship: string | null
  employer: string | null
  phone: string | null
  email: string | null
  country_code: string | null
  permission_to_contact: string | null
  sort_order: number
}

export type NannyDocument = {
  id: string
  application_id: string | null
  nanny_id: string | null
  kind: DocumentKind
  storage_path: string
  file_name: string | null
  mime_type: string | null
}

export type BookingPayload = {
  name?: string
  parentName?: string
  email: string
  phone?: string
  destination: string
  checkIn: string
  checkOut: string
  children?: string
  childrenCount?: string
  youngestAge?: string
  nanniesNeeded?: string
  tier?: string
  notes?: string
  message?: string
  nannyId?: string
  careType?: CareType
}
