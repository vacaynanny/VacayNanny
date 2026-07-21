/*
  SQL Schema for nanny_applications table:

  CREATE TABLE nanny_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           TEXT NOT NULL,
    date_of_birth       DATE,
    phone               TEXT,
    country_code        TEXT,
    email               TEXT,
    gender              TEXT,
    languages           TEXT[],
    county              TEXT,
    town                TEXT,
    national_id_number  TEXT,
    kra_pin             TEXT,
    cogc_status         TEXT,
    cogc_date           DATE,
    experience_years    TEXT,
    age_groups          TEXT[],
    services            TEXT[],
    bio                 TEXT,
    certifications      TEXT[],
    ref1_name           TEXT,
    ref1_relationship   TEXT,
    ref1_phone          TEXT,
    ref1_email          TEXT,
    ref1_employer       TEXT,
    ref1_contact        TEXT,
    ref2_name           TEXT,
    ref2_relationship   TEXT,
    ref2_phone          TEXT,
    ref2_email          TEXT,
    ref2_employer       TEXT,
    ref2_contact        TEXT,
    available_days      TEXT[],
    earliest_start      TEXT,
    latest_end          TEXT,
    willing_to_travel   TEXT,
    preferred_locations TEXT[],
    comfortable_pets    TEXT,
    comfortable_multiple TEXT,
    status              TEXT DEFAULT 'pending',
    created_at          TIMESTAMPTZ DEFAULT NOW()
  );
*/

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendApplicationEmails } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServerClient()

    const { error } = await supabase.from('nanny_applications').insert([
      {
        full_name: body.fullName,
        date_of_birth: body.dateOfBirth,
        phone: body.phone,
        country_code: body.countryCode,
        email: body.email,
        gender: body.gender,
        languages: body.languages,
        county: body.county,
        town: body.town,
        national_id_number: body.nationalIdNumber,
        kra_pin: body.kraPin,
        cogc_status: body.cogcStatus,
        cogc_date: body.cogcDate || null,
        experience_years: body.experienceYears,
        age_groups: body.ageGroups,
        services: body.services,
        bio: body.bio,
        certifications: body.certifications,
        ref1_name: body.ref1Name,
        ref1_relationship: body.ref1Relationship,
        ref1_phone: body.ref1Phone,
        ref1_email: body.ref1Email,
        ref1_employer: body.ref1Employer,
        ref1_contact: body.ref1Contact,
        ref2_name: body.ref2Name,
        ref2_relationship: body.ref2Relationship,
        ref2_phone: body.ref2Phone,
        ref2_email: body.ref2Email,
        ref2_employer: body.ref2Employer,
        ref2_contact: body.ref2Contact,
        available_days: body.availableDays,
        earliest_start: body.earliestStart,
        latest_end: body.latestEnd,
        willing_to_travel: body.willingToTravel,
        preferred_locations: body.preferredLocations,
        comfortable_pets: body.comfortablePets,
        comfortable_multiple: body.comfortableMultiple,
        status: 'pending',
      },
    ])

    if (error) {
      console.error('Supabase insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send confirmation to nanny + notification to admin
    // Non-blocking — a failed email doesn't fail the submission
    sendApplicationEmails({
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
      county: body.county,
      town: body.town,
      experienceYears: body.experienceYears,
      cogcStatus: body.cogcStatus,
      certifications: body.certifications ?? [],
      services: body.services ?? [],
      ageGroups: body.ageGroups ?? [],
      ref1Name: body.ref1Name,
      ref2Name: body.ref2Name,
      willingToTravel: body.willingToTravel,
    }).catch(err => console.error('sendApplicationEmails failed:', err))

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Apply route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
