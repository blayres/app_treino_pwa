import React from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/coachService', () => ({
  // Pure helpers (status, filter, invite link) stay real.
  ...(jest.requireActual('../../../src/services/coachService') as object),
  becomeCoach: jest.fn(),
  getCachedCoachCode: jest.fn(() => undefined),
  getCachedStudents: jest.fn(() => undefined),
  getCoachCode: jest.fn(),
  listStudents: jest.fn(),
}));
jest.mock('../../../src/services/videoService', () => ({
  ownVideos: () => new Map(),
  buildVideoMap: () => new Map(),
  getCachedVideoRows: jest.fn(() => undefined),
  getVideoRows: jest.fn(async () => []),
}));

import * as coachService from '../../../src/services/coachService';
import type { StudentSummary } from '../../../src/services/coachService';
import * as videoService from '../../../src/services/videoService';
import { navigation, resetNavigation } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDialogStore } from '../../../src/store/useDialogStore';
import { locales } from '../../../src/i18n/translations';
import CoachScreen from '../../../src/screens/CoachScreen';

const coach = coachService as jest.Mocked<typeof coachService>;
const t = locales.pt;
const CODE = 'ABC123';
const LINK = `${window.location.origin}/convite/${CODE}`;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const student = (id: number, name: string, extra: Partial<StudentSummary> = {}): StudentSummary => ({
  id,
  name,
  since: daysAgo(60),
  lastWorkoutAt: daysAgo(1),
  sessionsLast7: 3,
  sessionsLast30: 10,
  programDays: 4,
  ...extra,
});
const bruno = student(11, 'Bruno Lima');
const carla = student(12, 'Carla Dias', { programDays: 0 });

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  useAppStore.setState({ currentUser: { id: 5, name: 'Ana' } });
  useDialogStore.setState({ alert: null });
  coach.getCoachCode.mockResolvedValue(CODE);
  coach.listStudents.mockResolvedValue([bruno, carla]);
});

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else delete (navigator as any).clipboard;
});

describe('CoachScreen', () => {
  it('lists the coach\'s students with their status and what needs attention', async () => {
    render(<CoachScreen />);
    expect(await screen.findByText('Bruno Lima')).toBeTruthy();
    expect(coach.listStudents).toHaveBeenCalledWith(5);
    expect(screen.getByText(t.studentsCount(2))).toBeTruthy();
    expect(screen.getByText(t.statusNoProgram)).toBeTruthy();
    expect(screen.getByText(t.studentsNeedAttention(1))).toBeTruthy();
  });

  it('shows the invite code and link; copying puts the link on the clipboard', async () => {
    const writeText = jest.fn(async (_text: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CoachScreen />);
    expect(await screen.findByText(CODE)).toBeTruthy();
    expect(screen.getByText(LINK)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t.copyLink }));
    await waitFor(() => expect(useDialogStore.getState().alert?.message).toBe(t.linkCopied));
    expect(writeText).toHaveBeenCalledWith(LINK);
  });

  it('opening a student navigates with only their id', async () => {
    render(<CoachScreen />);
    fireEvent.click(await screen.findByRole('button', { name: /^Bruno Lima,/ }));
    expect(navigation.navigate).toHaveBeenCalledWith('CoachStudent', { studentId: 11 });
  });

  it('resetting the invite code asks for confirmation, then creates a new one', async () => {
    coach.becomeCoach.mockResolvedValue('NEW999');
    render(<CoachScreen />);
    await screen.findByText(CODE);
    fireEvent.click(screen.getByText(t.resetCode));
    expect(screen.getByText(t.resetCodeTitle)).toBeTruthy();
    expect(coach.becomeCoach).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(t.resetCodeConfirm));
    expect(await screen.findByText('NEW999')).toBeTruthy();
    expect(coach.becomeCoach).toHaveBeenCalledWith(true);
    // The students stay linked after a code reset.
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
  });

  it('a non-coach sees the intro and can become a coach (no invite, no students)', async () => {
    coach.getCoachCode.mockResolvedValue(null);
    coach.becomeCoach.mockResolvedValue(CODE);
    render(<CoachScreen />);
    expect(await screen.findByText(t.coachIntroTitle)).toBeTruthy();
    expect(coach.listStudents).not.toHaveBeenCalled();
    expect(screen.queryByText(t.copyLink)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.becomeCoach }));
    expect(await screen.findByText(CODE)).toBeTruthy();
    expect(coach.becomeCoach).toHaveBeenCalledWith(false);
    expect(screen.getByText(t.noStudents)).toBeTruthy();
  });

  it('search appears from 6 students and filters by name', async () => {
    const many = ['Ana Paula', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio'].map((name, i) => student(20 + i, name));
    coach.listStudents.mockResolvedValue(many);
    render(<CoachScreen />);
    fireEvent.change(await screen.findByLabelText(t.searchStudent), { target: { value: 'fabio' } });
    expect(screen.getByText('Fábio')).toBeTruthy();
    expect(screen.queryByText('Diego')).toBeNull();
  });

  it('videos section is hidden while FEATURES.coachVideos is off (no video request)', async () => {
    render(<CoachScreen />);
    await screen.findByText('Bruno Lima');
    expect(screen.queryByText(t.manageVideos)).toBeNull();
    expect(videoService.getVideoRows).not.toHaveBeenCalled();
  });
});
