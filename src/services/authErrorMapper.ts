export type AuthTranslator = {
  invalidCredentials: string;
  emailNotConfirmed: string;
  accountAlreadyExists: string;
  passwordTooWeak: string;
  networkError: string;
  genericError: string;
};

export function mapAuthError(
  rawMessage: string | undefined,
  t: AuthTranslator,
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

  return t.genericError;
}
