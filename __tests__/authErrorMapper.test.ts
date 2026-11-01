import { describe, expect, it } from '@jest/globals';
import { mapAuthError } from '../src/services/authErrorMapper';

const t = {
  invalidCredentials: 'invalid',
  emailNotConfirmed: 'unconfirmed',
  accountAlreadyExists: 'exists',
  passwordTooWeak: 'weak',
  networkError: 'network',
  genericError: 'generic',
};

describe('mapAuthError', () => {
  it.each([
    ['Invalid login credentials', 'invalid'],
    ['Email not confirmed', 'unconfirmed'],
    ['User already registered', 'exists'],
    ['Password should be at least 8 characters', 'weak'],
    ['Failed to fetch', 'network'],
    ['Something unexpected', 'generic'],
    [undefined, 'generic'],
  ])('%s → %s', (message, expected) => {
    expect(mapAuthError(message, t)).toBe(expected);
  });
});
