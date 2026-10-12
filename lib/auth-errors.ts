/**
 * User-friendly error messages for Supabase Auth errors.
 * Maps technical error messages to clear, helpful messages for users.
 */

export function getFriendlyAuthError(error: Error | string): string {
  const message = error instanceof Error ? error.message : String(error)

  // Normalize the message for matching
  const normalized = message.toLowerCase()

  // Login errors
  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid email or password') ||
    normalized.includes('wrong password') ||
    normalized.includes('authentication failed')
  ) {
    return 'The email or password you entered is incorrect. Please try again.'
  }

  if (
    normalized.includes('email not confirmed') ||
    normalized.includes('email_confirm') ||
    normalized.includes('confirm your email')
  ) {
    return 'Please confirm your email address first. Check your inbox for the confirmation link.'
  }

  if (
    normalized.includes('user not found') ||
    normalized.includes('no user found')
  ) {
    return "We couldn't find an account with that email. Please check the address or create a new account."
  }

  // Signup errors
  if (
    normalized.includes('user already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('email already registered') ||
    normalized.includes('duplicate')
  ) {
    return 'An account with this email already exists. Try signing in instead.'
  }

  if (
    normalized.includes('password should be at least') ||
    normalized.includes('weak password') ||
    normalized.includes('password too weak')
  ) {
    return 'Please choose a stronger password (at least 8 characters with a mix of letters, numbers, and symbols).'
  }

  if (
    normalized.includes('invalid email') ||
    normalized.includes('email format')
  ) {
    return 'Please enter a valid email address.'
  }

  // Rate limiting
  if (
    normalized.includes('too many requests') ||
    normalized.includes('rate limit') ||
    normalized.includes('over_email_send_limit')
  ) {
    return 'Too many attempts. Please wait a moment and try again.'
  }

  // Network / connectivity
  if (
    normalized.includes('network') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('connection') ||
    normalized.includes('timeout') ||
    normalized.includes('econnrefused') ||
    normalized.includes('socket')
  ) {
    return 'Unable to connect. Please check your internet connection and try again.'
  }

  // Token / session errors
  if (
    normalized.includes('invalid refresh token') ||
    normalized.includes('refresh token not found') ||
    normalized.includes('session not found') ||
    normalized.includes('jwt expired') ||
    normalized.includes('token expired')
  ) {
    return 'Your session has expired. Please sign in again.'
  }

  // MFA / OTP
  if (
    normalized.includes('invalid otp') ||
    normalized.includes('invalid code') ||
    normalized.includes('code expired') ||
    normalized.includes('otp expired')
  ) {
    return 'The code you entered is invalid or has expired. Please request a new one.'
  }

  // Phone
  if (
    normalized.includes('phone') &&
    (normalized.includes('invalid') || normalized.includes('already'))
  ) {
    return 'Please enter a valid phone number.'
  }

  // Generic fallback - return a friendly message instead of raw error
  if (normalized.includes('auth') || normalized.includes('supabase')) {
    return 'Something went wrong. Please try again in a moment.'
  }

  // If we can't map it, return a generic message
  return 'Something went wrong. Please try again.'
}

/**
 * Check if an error is a network/connection error that might be temporary
 */
export function isNetworkError(error: Error | string): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return (
    normalized.includes('network') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('connection') ||
    normalized.includes('timeout') ||
    normalized.includes('econnrefused') ||
    normalized.includes('socket')
  )
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: Error | string): boolean {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()
  return (
    normalized.includes('too many requests') ||
    normalized.includes('rate limit') ||
    normalized.includes('over_email_send_limit')
  )
}