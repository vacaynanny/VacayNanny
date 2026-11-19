export type EmailSettings = {
  mode: 'send' | 'disabled'
  from: string
  replyTo: string
  apiKey: string | undefined
}

export function emailSettings(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): EmailSettings {
  const isPreview = Boolean(env.VERCEL_ENV && env.VERCEL_ENV !== 'production')
  const defaultMode =
    env.NODE_ENV === 'production' && !isPreview ? 'send' : 'disabled'
  return {
    mode:
      (env.EMAIL_DELIVERY_MODE || defaultMode) === 'send' ? 'send' : 'disabled',
    from:
      env.RESEND_FROM_EMAIL?.trim() || 'VacayNanny <noreply@vacaynanny.net>',
    replyTo: env.RESEND_REPLY_TO_EMAIL?.trim() || 'hello@vacaynanny.net',
    apiKey: env.RESEND_API_KEY?.trim() || undefined,
  }
}
