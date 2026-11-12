import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/authService', () => ({ sendPasswordReset: jest.fn() }));

import * as authService from '../../../src/services/authService';
import { navigation, resetNavigation } from '../helpers/navigationMock';
import { locales } from '../../../src/i18n/translations';
import ForgotPasswordScreen from '../../../src/screens/ForgotPasswordScreen';

const auth = authService as jest.Mocked<typeof authService>;
const t = locales.pt;
const EMAIL = 'ana@example.com';

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
});

// The e-mail field has no accessibilityLabel: found by its placeholder.
const emailInput = () => screen.getByPlaceholderText(t.emailPlaceholder);
const typeEmail = (value: string) => fireEvent.change(emailInput(), { target: { value } });

describe('ForgotPasswordScreen', () => {
  it('asks for the e-mail and does not call the server when empty', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.click(screen.getByText(t.sendLink));
    expect(screen.getByText(t.emailRequired)).toBeTruthy();
    expect(auth.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('sends the link to the trimmed e-mail and confirms it', async () => {
    auth.sendPasswordReset.mockResolvedValue(undefined as any);
    render(<ForgotPasswordScreen />);
    typeEmail(`  ${EMAIL} `);
    fireEvent.click(screen.getByText(t.sendLink));
    expect(auth.sendPasswordReset).toHaveBeenCalledWith(EMAIL);
    expect(await screen.findByText(t.resetSuccess)).toBeTruthy();
  });

  it('cannot be sent twice while sending', async () => {
    let finish!: () => void;
    auth.sendPasswordReset.mockReturnValue(new Promise<any>((resolve) => (finish = () => resolve(undefined))));
    render(<ForgotPasswordScreen />);
    typeEmail(EMAIL);
    fireEvent.click(screen.getByText(t.sendLink));
    // The label stays the same while sending (CLAUDE.md); the button is disabled.
    const button = screen.getByRole('button', { name: t.sendLink });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    expect(auth.sendPasswordReset).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.getByText(t.sendLink)).toBeTruthy();
  });

  it('shows a translated message, never the raw server error', async () => {
    auth.sendPasswordReset.mockRejectedValueOnce(new Error('Email rate limit exceeded'));
    render(<ForgotPasswordScreen />);
    typeEmail(EMAIL);
    fireEvent.click(screen.getByText(t.sendLink));
    expect(await screen.findByText(t.tooManyAttempts)).toBeTruthy();
    expect(screen.queryByText(/rate limit/i)).toBeNull();
    expect(screen.queryByText(t.resetSuccess)).toBeNull();

    auth.sendPasswordReset.mockRejectedValueOnce(new Error('unexpected_failure: smtp'));
    fireEvent.click(screen.getByText(t.sendLink));
    expect(await screen.findByText(t.resetDefaultError)).toBeTruthy();
    expect(screen.queryByText(/smtp/)).toBeNull();
  });

  it('goes back to login', () => {
    render(<ForgotPasswordScreen />);
    fireEvent.click(screen.getByText(t.backToLogin));
    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});
