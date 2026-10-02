-- Sample destinations, nannies, and reviews so the marketing site is live.
-- Safe to re-run: uses upserts on unique slugs.

insert into public.destinations (slug, name, country, image_url, description, sort_order) values
  ('diani-beach', 'Diani Beach', 'Kenya',
    'https://images.unsplash.com/photo-1651860282131-e3257674ccd1?w=1600&auto=format&fit=crop&q=80',
    'White sand, turquoise water, and family-friendly resorts south of Mombasa.', 1),
  ('malindi', 'Malindi', 'Kenya',
    'https://images.unsplash.com/photo-1645689600188-1945e19b8228?w=1600&auto=format&fit=crop&q=80',
    'Historic coastal town with calm beaches and Italian-influenced dining.', 2),
  ('watamu', 'Watamu', 'Kenya',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&auto=format&fit=crop&q=80',
    'Marine park, snorkelling, and quiet boutique stays.', 3),
  ('nairobi', 'Nairobi', 'Kenya',
    'https://images.unsplash.com/photo-1669127300649-940337f1487e?w=1600&auto=format&fit=crop&q=80',
    'City breaks, business travel, and safari gateways.', 4),
  ('mombasa', 'Mombasa', 'Kenya',
    'https://images.unsplash.com/photo-1579005318686-5a86bbb3bf03?w=1600&auto=format&fit=crop&q=80',
    'Old Town, Nyali, and Bamburi beach hotels.', 5),
  ('lamu', 'Lamu', 'Kenya',
    'https://images.unsplash.com/photo-1711802536772-0ef59886bc1b?w=1600&auto=format&fit=crop&q=80',
    'Car-free island, dhows, and slow Swahili living.', 6),
  ('masai-mara', 'Masai Mara', 'Kenya',
    'https://images.unsplash.com/photo-1518459384564-ecfd8e80721f?w=1600&auto=format&fit=crop&q=80',
    'Safari camps and lodges during the migration and beyond.', 7),
  ('amboseli', 'Amboseli', 'Kenya',
    'https://images.unsplash.com/photo-1510837267498-0148e51cdfc0?w=1600&auto=format&fit=crop&q=80',
    'Elephants on the plains with Kilimanjaro as backdrop.', 8),
  ('zanzibar', 'Zanzibar', 'Tanzania',
    'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=1600&auto=format&fit=crop&q=80',
    'Spice island beaches and Stone Town — expanding coverage.', 9)
on conflict (slug) do update set
  name = excluded.name,
  country = excluded.country,
  image_url = excluded.image_url,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.nannies (
  slug, display_name, photo_url, bio, tier, daily_rate_kes, county, town,
  destinations, languages, age_groups, services, certifications, tags,
  available_days, willing_to_travel, is_active, rating_avg, review_count
) values
(
  'amara-ochieng', 'Amara Ochieng',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&auto=format&fit=crop',
  'Warm, energetic Elite nanny with a decade of infant and toddler care along the south coast. CPR and paediatric first-aid certified, strong swimmer, and fluent in English and Swahili.',
  'gold', 4500, 'Kwale', 'Diani Beach',
  array['Diani Beach','Mombasa'],
  array['English','Swahili'],
  array['Infants (0–12 months)','Toddlers (1–3 years)','Preschool (3–5 years)'],
  array['Daytime childcare','Overnight care','Hotel / resort childcare','Travel nanny'],
  array['CPR','First Aid'],
  array['Infant care','CPR/First Aid','Swahili/English','Swimming'],
  array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  'kenya', true, 5.00, 48
),
(
  'faith-wanjiku', 'Faith Wanjiku',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop',
  'Professional nanny who splits time between Nairobi and the coast. Loves arts, crafts, and homework help for ages 2–10.',
  'silver', 3200, 'Nairobi', 'Westlands',
  array['Nairobi','Mombasa'],
  array['English','Kikuyu'],
  array['Toddlers (1–3 years)','Preschool (3–5 years)','School-age (6–12 years)'],
  array['Daytime childcare','Homework help','Meal preparation'],
  array['First Aid'],
  array['Ages 2–10','Arts & Crafts','English/Kikuyu','Tutoring'],
  array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  'kenya', true, 5.00, 31
),
(
  'grace-atieno', 'Grace Atieno',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&auto=format&fit=crop',
  'Elite travel nanny based in Malindi. Montessori-informed, comfortable with newborns, and happy to join families on safari or to Zanzibar.',
  'gold', 4800, 'Kilifi', 'Malindi',
  array['Malindi','Watamu','Zanzibar'],
  array['English','Swahili','French'],
  array['Infants (0–12 months)','Toddlers (1–3 years)','Preschool (3–5 years)'],
  array['Daytime childcare','Overnight care','Travel nanny','Hotel / resort childcare'],
  array['CPR','First Aid','ECD'],
  array['Newborn','Montessori','French/Swahili','Travel nanny'],
  array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  'international', true, 5.00, 62
),
(
  'mercy-kamau', 'Mercy Kamau',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&auto=format&fit=crop',
  'Calm, practical Professional nanny covering Lamu and Malindi. Great with school-age children, swimming supervision, and simple Kenyan meals.',
  'silver', 3000, 'Lamu', 'Lamu Town',
  array['Lamu','Malindi'],
  array['English','Swahili'],
  array['Preschool (3–5 years)','School-age (6–12 years)'],
  array['Daytime childcare','Evening childcare','Meal preparation'],
  array['First Aid'],
  array['Ages 3–12','Swimming','English/Swahili','Cooking'],
  array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  'kenya', true, 4.00, 22
),
(
  'patience-njeri', 'Patience Njeri',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&auto=format&fit=crop',
  'Nationwide Elite carer with special-needs experience, BSL basics, and overnight placements. Families book her for longer Nairobi and safari trips.',
  'gold', 5200, 'Nairobi', 'Karen',
  array['Nairobi','Masai Mara','Amboseli'],
  array['English','Swahili'],
  array['Infants (0–12 months)','Toddlers (1–3 years)','School-age (6–12 years)','Teens (13–17 years)'],
  array['Special needs support','Overnight care','Travel nanny','Homework help'],
  array['CPR','First Aid','Nursing'],
  array['Special needs','BSL basics','Fluent English','Overnight'],
  array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  'international', true, 5.00, 55
),
(
  'rose-achieng', 'Rose Achieng',
  'https://images.unsplash.com/photo-1489424731084-a5d8b86c3b24?w=600&auto=format&fit=crop',
  'Friendly Basic-tier nanny in Mombasa and Diani. Outdoor play, arts, and reliable daytime cover for ages 4–14.',
  'bronze', 2200, 'Mombasa', 'Nyali',
  array['Mombasa','Diani Beach'],
  array['English','Swahili'],
  array['Preschool (3–5 years)','School-age (6–12 years)','Teens (13–17 years)'],
  array['Daytime childcare','Hotel / resort childcare'],
  array[]::text[],
  array['Ages 4–14','Outdoor play','Swahili/English','Arts'],
  array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  'county', true, 4.00, 18
)
on conflict (slug) do update set
  display_name = excluded.display_name,
  photo_url = excluded.photo_url,
  bio = excluded.bio,
  tier = excluded.tier,
  daily_rate_kes = excluded.daily_rate_kes,
  destinations = excluded.destinations,
  languages = excluded.languages,
  tags = excluded.tags,
  is_active = excluded.is_active;

-- Reviews (skip if this nanny already has seed reviews)
insert into public.reviews (nanny_id, parent_name, trip_label, rating, body, avatar_url, is_published)
select n.id, v.parent_name, v.trip_label, v.rating, v.body, v.avatar_url, true
from (
  values
    ('grace-atieno', 'Sarah M.', 'Diani Beach, December 2024', 5,
      'We hired Grace for 5 days in Diani. She was incredible with our 2-year-old and 4-year-old. My husband and I finally had real couple time on a holiday for the first time in years. We''ll never travel without VacayNanny again.',
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&auto=format&fit=crop'),
    ('faith-wanjiku', 'David & Priya K.', 'Masai Mara, August 2024', 5,
      'Faith joined us on safari in the Mara. She kept our kids engaged, did educational activities about wildlife, and managed mealtime like a pro. Worth every shilling. Absolute peace of mind.',
      'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&auto=format&fit=crop'),
    ('amara-ochieng', 'Christine O.', 'Watamu, April 2025', 5,
      'As a solo mum travelling with 3 kids, I was nervous. Amara was a godsend — professional, warm, and my kids adored her. The booking process was seamless and customer support was always available.',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&auto=format&fit=crop')
) as v(slug, parent_name, trip_label, rating, body, avatar_url)
join public.nannies n on n.slug = v.slug
where not exists (
  select 1 from public.reviews r
  where r.nanny_id = n.id and r.parent_name = v.parent_name
);

-- Seed Elite nannies have already completed safeguarding.
update public.nannies
set safeguarding_completed_at = coalesce(safeguarding_completed_at, created_at)
where slug in ('amara-ochieng', 'grace-atieno', 'patience-njeri');
