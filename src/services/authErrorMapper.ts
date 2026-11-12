export type AuthTranslator = {
  invalidCredentials: string;
  emailNotConfirmed: string;
  accountAlreadyExists: string;
  passwordTooWeak: string;
  networkError: string;
  tooManyAttempts: string;
  genericError: string;
};

/**
 * Supabase/auth error → message for the user in their language. Raw server
 * messages (English, technical) are never shown. `fallback` replaces the
 * generic message for unknown errors (e.g. "Could not delete your account").
 */

export function mapAuthError(
  rawMessage: string | undefined,
  t: AuthTranslator,
  fallback: string = t.genericError,
): string {
  const message = (rawMessage ?? '').toLowerCase();

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return t.invalidCredentials;
  }

  if (
    message.includes('email not confirmed') ||
    message.includes('email_not_confirmed')
  ) {
    return t.emailNotConfirmed;
  }

  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('user already registered')
  ) {
    return t.accountAlreadyExists;
  }

  if (
    message.includes('weak password') ||
    message.includes('password should')
  ) {
    return t.passwordTooWeak;
  }

  if (
    message.includes('network') ||
    message.includes('failed to fetch')
  ) {
    return t.networkError;
  }

  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('over_email_send_rate_limit')
  ) {
    return t.tooManyAttempts;
  }

  return fallback;
}
