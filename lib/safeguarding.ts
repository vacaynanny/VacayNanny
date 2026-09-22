import { TIER_RATES } from '@/lib/constants'
import type { Nanny, NannyTier } from '@/lib/types'

export const SAFEGUARDING_PASS_MARK = 4

export const SAFEGUARDING_MODULES = [
  {
    id: 'duty',
    title: 'Duty of care',
    body: 'You are responsible for every child in your charge until you hand them back to a parent or an authorised adult. Never leave children unsupervised, never hand a child to someone you have not been told to, and never consume alcohol or drugs while on a VacayNanny placement.',
  },
  {
    id: 'boundaries',
    title: 'Safe boundaries',
    body: 'Work in open, observable spaces. Do not take a child into a locked room, private bathroom, or off the booked property without the parent’s written or in-app go-ahead. Do not share your personal social accounts with children. Do not photograph or film children unless the family has asked you to, and never post family photos publicly.',
  },
  {
    id: 'emergencies',
    title: 'Emergencies',
    body: 'In a medical or safety emergency in Kenya, call 112 or 999 first, then the parents, then VacayNanny. Know the hotel or house address before the shift starts. Keep first-aid and allergy notes from the booking in reach. Do not give medication unless the family has authorised that specific medicine and dose.',
  },
  {
    id: 'reporting',
    title: 'If something feels wrong',
    body: 'If a child is hurt, missing, or at risk — or if a parent asks you to do something unsafe — stop, keep the child safe, and report to VacayNanny immediately through the booking thread or +254 796 930 612. You will never be penalised for raising a genuine safeguarding concern.',
  },
] as const

export const SAFEGUARDING_QUIZ: Array<{
  id: string
  prompt: string
  options: string[]
  answer: number
}> = [
  {
    id: 'q1',
    prompt: 'A neighbour you have not met offers to take the children to the beach so you can rest. What do you do?',
    options: [
      'Let them go if the neighbour seems kind.',
      'Only release children to a parent or an adult the family named for this booking.',
      'Ask the children if they know the neighbour, then decide.',
      'Leave a note for the parents and allow it.',
    ],
    answer: 1,
  },
  {
    id: 'q2',
    prompt: 'A child is badly injured during the shift. What is the first call?',
    options: [
      'VacayNanny support, then wait for instructions.',
      'Post in the booking thread and wait for a reply.',
      'Emergency services (112 or 999), then the parents, then VacayNanny.',
      'The hotel front desk only.',
    ],
    answer: 2,
  },
  {
    id: 'q3',
    prompt: 'The family asks you to post cute photos of their toddler on your Instagram. What is correct?',
    options: [
      'Never post family photos publicly, even if asked in passing — only share privately if they requested it in the booking.',
      'Post if you hide the child’s face.',
      'Post if you do not tag the location.',
      'Post after the placement ends.',
    ],
    answer: 0,
  },
  {
    id: 'q4',
    prompt: 'A parent asks you to give a medicine that is not listed on the booking. You should:',
    options: [
      'Give a small dose if the child seems unwell.',
      'Refuse any medicine that was not authorised, and message the family in the booking thread.',
      'Buy a chemist equivalent and keep the receipt.',
      'Ask the child if they have taken it before.',
    ],
    answer: 1,
  },
  {
    id: 'q5',
    prompt: 'You see something that makes you worry a child is not safe. VacayNanny’s rule is:',
    options: [
      'Wait until the placement is completed so you do not upset the family.',
      'Discuss it only with other nannies in the destination.',
      'Keep the child safe and report to VacayNanny immediately. You will not be penalised for a genuine concern.',
      'Delete the booking thread so there is no record.',
    ],
    answer: 2,
  },
]

export function scoreSafeguardingQuiz(answers: unknown): { score: number; passed: boolean } {
  if (!Array.isArray(answers) || answers.length !== SAFEGUARDING_QUIZ.length) {
    return { score: 0, passed: false }
  }
  let score = 0
  SAFEGUARDING_QUIZ.forEach((question, index) => {
    if (Number(answers[index]) === question.answer) score += 1
  })
  return { score, passed: score >= SAFEGUARDING_PASS_MARK }
}

export function publicTier(nanny: Pick<Nanny, 'tier' | 'safeguarding_completed_at'>): NannyTier {
  if (nanny.tier === 'gold' && nanny.safeguarding_completed_at === null) return 'silver'
  return nanny.tier
}

export function needsSafeguardingModule(nanny: Pick<Nanny, 'tier' | 'safeguarding_completed_at'>): boolean {
  return nanny.tier === 'gold' && nanny.safeguarding_completed_at === null
}

export function publicDailyRate(nanny: Pick<Nanny, 'tier' | 'daily_rate_kes' | 'safeguarding_completed_at'>): number {
  const shown = publicTier(nanny)
  if (shown === nanny.tier) return nanny.daily_rate_kes
  return TIER_RATES[shown]
}
