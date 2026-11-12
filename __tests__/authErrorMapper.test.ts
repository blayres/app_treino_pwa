import { describe, expect, it } from '@jest/globals';
import { mapAuthError } from '../src/services/authErrorMapper';

const t = {
  invalidCredentials: 'invalid',
  emailNotConfirmed: 'unconfirmed',
  accountAlreadyExists: 'exists',
  passwordTooWeak: 'weak',
  networkError: 'network',
  tooManyAttempts: 'slow down',
  genericError: 'generic',
};

describe('mapAuthError', () => {
  it.each([
    ['Invalid login credentials', 'invalid'],
    ['Email not confirmed', 'unconfirmed'],
    ['User already registered', 'exists'],
    ['Password should be at least 8 characters', 'weak'],
    ['Failed to fetch', 'network'],
    ['Email rate limit exceeded', 'slow down'],
    ['Too Many Requests', 'slow down'],
    ['Something unexpected', 'generic'],
    [undefined, 'generic'],
  ])('%s → %s', (message, expected) => {
    expect(mapAuthError(message, t)).toBe(expected);
  });
});

describe('mapAuthError fallback', () => {
  it('uses the given fallback for unknown errors, never the raw message', () => {
    expect(mapAuthError('relation "profiles" violates row-level security', t, 'Could not delete')).toBe('Could not delete');
    expect(mapAuthError('Failed to fetch', t, 'Could not delete')).toBe('network');
  });
});
