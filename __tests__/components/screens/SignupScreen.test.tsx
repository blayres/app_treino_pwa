import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/authService', () => ({
  signUpWithEmail: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

import * as authService from '../../../src/services/authService';
import { navigation, resetNavigation } from '../helpers/navigationMock';
import { locales } from '../../../src/i18n/translations';
import SignupScreen from '../../../src/screens/SignupScreen';

const auth = authService as jest.Mocked<typeof authService>;
const t = locales.pt;

// Obviously fake data: never type real credentials in tests.
const EMAIL = 'ana@example.com';
const PASSWORD = 'senha-teste-123';

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
});

const fill = (fields: { name?: string; email?: string; password?: string; confirm?: string }) => {
  const set = (label: string, value?: string) =>
    value !== undefined && fireEvent.change(screen.getByLabelText(label), { target: { value } });
  set(t.namePlaceholder, fields.name);
  set(t.emailPlaceholder, fields.email);
  set(t.passwordPlaceholder, fields.password);
  set(t.confirmPasswordPlaceholder, fields.confirm);
};
const submitButton = () => screen.getByRole('button', { name: t.signupButtonLabel });

describe('SignupScreen', () => {
  it.each([
    ['name missing', { name: '   ', email: EMAIL, password: PASSWORD, confirm: PASSWORD }, t.nameRequired],
    ['e-mail missing', { name: 'Ana', email: '', password: PASSWORD, confirm: PASSWORD }, t.emailRequired],
    ['invalid e-mail', { name: 'Ana', email: 'ana@example', password: PASSWORD, confirm: PASSWORD }, t.invalidEmail],
    ['password missing', { name: 'Ana', email: EMAIL, password: '', confirm: '' }, t.passwordRequired],
    ['password too short', { name: 'Ana', email: EMAIL, password: '1234567', confirm: '1234567' }, t.passwordTooShort],
    ['passwords differ', { name: 'Ana', email: EMAIL, password: PASSWORD, confirm: `${PASSWORD}x` }, t.passwordMismatch],
  ])('rejects the form when %s, without calling the server', (_case, fields, message) => {
    render(<SignupScreen />);
    fill(fields);
    fireEvent.click(submitButton());
    expect(screen.getByText(message)).toBeTruthy();
    expect(auth.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('creates the account with trimmed name and trimmed lower-cased e-mail', async () => {
    auth.signUpWithEmail.mockResolvedValue(undefined as any);
    render(<SignupScreen />);
    fill({ name: '  Ana Souza ', email: '  Ana@Example.COM ', password: PASSWORD, confirm: PASSWORD });
    fireEvent.click(submitButton());
    expect(auth.signUpWithEmail).toHaveBeenCalledWith(EMAIL, PASSWORD, 'Ana Souza');
    expect(await screen.findByText(t.signupSuccess)).toBeTruthy();
    // Passwords are cleared from the form after success.
    expect((screen.getByLabelText(t.passwordPlaceholder) as HTMLInputElement).value).toBe('');
  });

  it('while creating: button disabled with the same label, fields read-only', async () => {
    let finish!: () => void;
    auth.signUpWithEmail.mockReturnValue(new Promise<any>((resolve) => (finish = () => resolve(undefined))));
    render(<SignupScreen />);
    fill({ name: 'Ana', email: EMAIL, password: PASSWORD, confirm: PASSWORD });
    fireEvent.click(submitButton());
    expect(submitButton().getAttribute('aria-disabled')).toBe('true');
    expect(submitButton().textContent).toBe(t.signupButtonLabel);
    expect((screen.getByLabelText(t.emailPlaceholder) as HTMLInputElement).readOnly).toBe(true);
    // A second tap does not create a second account.
    fireEvent.click(submitButton());
    expect(auth.signUpWithEmail).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(submitButton().getAttribute('aria-disabled')).toBeNull();
  });

  it('after success, goes to login with the e-mail prefilled', async () => {
    auth.signUpWithEmail.mockResolvedValue(undefined as any);
    jest.useFakeTimers();
    try {
      render(<SignupScreen />);
      fill({ name: 'Ana', email: EMAIL, password: PASSWORD, confirm: PASSWORD });
      fireEvent.click(submitButton());
      await act(async () => {});
      expect(navigation.reset).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(1800);
      });
      expect(navigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login', params: { email: EMAIL } }],
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('maps an existing account error to a friendly message', async () => {
    auth.signUpWithEmail.mockRejectedValue(new Error('User already registered'));
    render(<SignupScreen />);
    fill({ name: 'Ana', email: EMAIL, password: PASSWORD, confirm: PASSWORD });
    fireEvent.click(submitButton());
    expect(await screen.findByText(t.accountAlreadyExists)).toBeTruthy();
    expect(screen.queryByText('User already registered')).toBeNull();
    expect(navigation.reset).not.toHaveBeenCalled();
  });

  it('links back to login', () => {
    render(<SignupScreen />);
    fireEvent.click(screen.getByRole('link', { name: t.alreadyHaveAccount }));
    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});
