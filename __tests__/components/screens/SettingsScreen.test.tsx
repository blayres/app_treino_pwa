import React from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/authService', () => ({
  deleteCurrentAccount: jest.fn(),
  getCurrentUserEmail: jest.fn(),
  logout: jest.fn(),
  updateCurrentUserName: jest.fn(),
}));
jest.mock('../../../src/services/coachService', () => ({
  // Pure helpers stay real (error → i18n key).
  ...(jest.requireActual('../../../src/services/coachService') as object),
  getCachedMyCoach: jest.fn(() => undefined),
  getMyCoach: jest.fn(),
  joinCoach: jest.fn(),
}));

import * as authService from '../../../src/services/authService';
import * as coachService from '../../../src/services/coachService';
import { CoachCodeError } from '../../../src/services/coachService';
import { navigation, resetNavigation } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDialogStore } from '../../../src/store/useDialogStore';
import { useI18n } from '../../../src/i18n';
import { locales } from '../../../src/i18n/translations';
import SettingsScreen from '../../../src/screens/SettingsScreen';

const auth = authService as jest.Mocked<typeof authService>;
const coach = coachService as jest.Mocked<typeof coachService>;
const t = locales.pt;

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  useAppStore.setState({
    currentUser: { id: 5, name: 'Ana' },
    activeSession: { sessionId: 9, workoutId: 10, startedAt: new Date().toISOString(), isRunning: true },
  });
  useDialogStore.setState({ alert: null });
  auth.getCurrentUserEmail.mockResolvedValue('ana@example.com');
  coach.getMyCoach.mockResolvedValue({ id: 1, name: 'Carlos' } as any);
});

afterEach(() => {
  act(() => useI18n.getState().setLocale('pt'));
});

const renderScreen = async () => {
  render(<SettingsScreen />);
  await waitFor(() => expect((screen.getByLabelText(t.email) as HTMLInputElement).value).toBe('ana@example.com'));
};

describe('SettingsScreen', () => {
  it('shows the account e-mail read-only and the current name', async () => {
    await renderScreen();
    expect((screen.getByLabelText(t.email) as HTMLInputElement).readOnly).toBe(true);
    expect((screen.getByLabelText(t.username) as HTMLInputElement).value).toBe('Ana');
  });

  it('switches the app language', async () => {
    await renderScreen();
    const trigger = screen.getByRole('button', { name: `${t.language}: Português` });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    // Options say which language is the current one (menuitemradio + aria-checked).
    expect((await screen.findByRole('menuitemradio', { name: 'Português' })).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemradio', { name: 'English' }).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    expect(useI18n.getState().locale).toBe('en');
    expect(localStorage.getItem('locale')).toBe('en');
    expect(screen.getByText(locales.en.settings)).toBeTruthy();
  });

  it('logout asks for confirmation first; cancelling keeps the user signed in', async () => {
    await renderScreen();
    fireEvent.click(screen.getByText(t.logout));
    expect(screen.getByText(t.logoutConfirmTitle)).toBeTruthy();
    expect(auth.logout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(t.cancel));
    expect(auth.logout).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentUser).not.toBeNull();
  });

  it('confirmed logout signs out, clears the user and the session, and returns to login', async () => {
    auth.logout.mockResolvedValue(undefined as any);
    await renderScreen();
    fireEvent.click(screen.getByText(t.logout));
    // The modal's confirm button is the last "Sair" on screen.
    fireEvent.click(screen.getAllByText(t.logout).at(-1)!);
    await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().currentUser).toBeNull();
    expect(useAppStore.getState().activeSession).toBeNull();
  });

  it('account deletion needs confirmation and only then deletes', async () => {
    auth.deleteCurrentAccount.mockResolvedValue(undefined);
    await renderScreen();
    fireEvent.click(screen.getByText(t.deleteAccount));
    expect(screen.getByText(t.deleteAccountTitle)).toBeTruthy();
    expect(auth.deleteCurrentAccount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(t.deleteAccountConfirm));
    await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] }));
    expect(auth.deleteCurrentAccount).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().currentUser).toBeNull();
  });

  it('a failed deletion keeps the user signed in and shows a translated error (not the raw one)', async () => {
    auth.deleteCurrentAccount.mockRejectedValue(new Error('boom: permission denied for table profiles'));
    await renderScreen();
    fireEvent.click(screen.getByText(t.deleteAccount));
    fireEvent.click(screen.getByText(t.deleteAccountConfirm));
    expect((await screen.findByRole('alert')).textContent).toBe(t.deleteAccountError);
    expect(navigation.reset).not.toHaveBeenCalled();
    expect(useAppStore.getState().currentUser).toEqual({ id: 5, name: 'Ana' });
  });

  it('without a coach: joins one by code (normalized) and maps a wrong code to a message', async () => {
    coach.getMyCoach.mockResolvedValue(null);
    coach.joinCoach.mockRejectedValueOnce(new CoachCodeError('invalid')).mockResolvedValueOnce('Carlos');
    await renderScreen();
    const input = await screen.findByLabelText(t.coachCodePlaceholder);
    fireEvent.change(input, { target: { value: 'ab-12 c' } });
    expect((input as HTMLInputElement).value).toBe('AB12C');

    fireEvent.click(screen.getByText(t.joinCoachButton));
    expect(await screen.findByText(t.invalidCoachCode)).toBeTruthy();
    expect(coach.joinCoach).toHaveBeenLastCalledWith('AB12C');

    fireEvent.click(screen.getByText(t.joinCoachButton));
    await waitFor(() => expect(useDialogStore.getState().alert?.message).toBe(t.joinedCoach('Carlos')));
    // Having a coach now: the card (and its code field) disappears.
    expect(screen.queryByLabelText(t.coachCodePlaceholder)).toBeNull();
  });
});
