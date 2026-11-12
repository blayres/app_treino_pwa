import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
// The e-mail form only exists with the online backend.
jest.mock('../../../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));
jest.mock('../../../src/services/authService', () => ({
  getLocalUsers: jest.fn(async () => []),
  loginWithEmail: jest.fn(),
  setLocalCurrentUser: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

import * as authService from '../../../src/services/authService';
import { navigation, resetNavigation, setRoute } from '../helpers/navigationMock';
import { locales } from '../../../src/i18n/translations';
import LoginScreen from '../../../src/screens/LoginScreen';

const auth = authService as jest.Mocked<typeof authService>;
const t = locales.pt;

// Obviously fake credentials: never type real ones in tests.
const EMAIL = 'ana@example.com';
const PASSWORD = 'senha-teste-123';

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  setRoute(undefined, 'Login');
});

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText(t.emailPlaceholder), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(t.passwordPlaceholder), { target: { value: password } });
};
// Async act: the sign-in finishes (loading off) inside act, no warnings.
const submit = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: t.accessButton }));
  });

describe('LoginScreen', () => {
  it('asks for both fields and does not call the server when one is missing', async () => {
    render(<LoginScreen />);
    fill(EMAIL, '');
    await submit();
    expect(screen.getByText(t.requiredFieldsMsg)).toBeTruthy();
    expect(auth.loginWithEmail).not.toHaveBeenCalled();
  });

  it('signs in with the e-mail and the password exactly as typed', async () => {
    auth.loginWithEmail.mockResolvedValue(undefined as any);
    render(<LoginScreen />);
    // The e-mail input is type="email": the DOM itself strips surrounding spaces, so the
    // screen's own trim cannot be observed here.
    fill(`  ${EMAIL}  `, ` ${PASSWORD} `);
    await submit();
    // Spaces in a password are meaningful: it is never trimmed.
    expect(auth.loginWithEmail).toHaveBeenCalledWith(EMAIL, ` ${PASSWORD} `);
    expect(screen.queryByText(t.requiredFieldsMsg)).toBeNull();
  });

  it('shows a friendly message instead of the raw server error', async () => {
    auth.loginWithEmail.mockRejectedValue(new Error('Invalid login credentials'));
    render(<LoginScreen />);
    fill(EMAIL, PASSWORD);
    await submit();
    expect(await screen.findByText(t.invalidCredentials)).toBeTruthy();
    expect(screen.queryByText('Invalid login credentials')).toBeNull();
  });

  it('maps unknown and network errors without leaking details', async () => {
    auth.loginWithEmail.mockRejectedValueOnce(new Error('relation "profiles" does not exist'));
    render(<LoginScreen />);
    fill(EMAIL, PASSWORD);
    await submit();
    expect(await screen.findByText(t.genericError)).toBeTruthy();
    expect(screen.queryByText(/relation/)).toBeNull();

    auth.loginWithEmail.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await submit();
    expect(await screen.findByText(t.networkError)).toBeTruthy();
  });

  it('signs in once even if "Acessar" is tapped again while it is signing in', async () => {
    let finish!: () => void;
    auth.loginWithEmail.mockReturnValue(new Promise<any>((resolve) => (finish = () => resolve(undefined))));
    render(<LoginScreen />);
    fill(EMAIL, PASSWORD);
    await submit();
    await submit();
    expect(auth.loginWithEmail).toHaveBeenCalledTimes(1);
    // Same label while signing in; disabled and announced as busy.
    const button = screen.getByRole('button', { name: t.accessButton });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    await act(async () => finish());
    expect(button.getAttribute('aria-disabled')).toBeNull();
  });

  it('prefills the e-mail passed by the signup screen', () => {
    setRoute({ email: EMAIL }, 'Login');
    render(<LoginScreen />);
    expect((screen.getByLabelText(t.emailPlaceholder) as HTMLInputElement).value).toBe(EMAIL);
  });

  it('links to password recovery and signup', () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByText(t.forgotPassword));
    expect(navigation.navigate).toHaveBeenLastCalledWith('ForgotPassword');
    fireEvent.click(screen.getByText(t.createAccount));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Signup');
  });

  it('Google sign-in: button is disabled while the redirect starts, errors are mapped', async () => {
    let fail!: (err: Error) => void;
    auth.signInWithGoogle.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    render(<LoginScreen />);
    const google = screen.getByRole('button', { name: t.continueWithGoogle });
    fireEvent.click(google);
    expect(google.getAttribute('aria-disabled')).toBe('true');
    expect(google.textContent).toContain(t.continueWithGoogle);
    fail(new Error('Failed to fetch'));
    expect(await screen.findByText(t.networkError)).toBeTruthy();
    expect(google.getAttribute('aria-disabled')).toBeNull();
  });
});
