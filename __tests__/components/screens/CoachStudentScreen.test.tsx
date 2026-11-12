import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/coachService', () => ({
  ...(jest.requireActual('../../../src/services/coachService') as object),
  getCachedStudent: jest.fn(() => undefined),
  getStudent: jest.fn(),
  unlinkStudent: jest.fn(),
}));
jest.mock('../../../src/services/programService', () => ({
  loadProgramDraft: jest.fn(),
  peekProgramDraft: jest.fn(() => null),
  visibleDays: (days: { hidden?: boolean }[]) => days.filter((day) => !day.hidden),
}));
// Attendance calendar of the student (child component).
jest.mock('../../../src/services/attendanceService', () => ({
  getAttendanceDatesByMonth: jest.fn(async () => ({ dates: new Set<string>(), totalDays: 30 })),
  getCachedAttendanceMonth: jest.fn(() => null),
}));

import * as coachService from '../../../src/services/coachService';
import type { StudentSummary } from '../../../src/services/coachService';
import * as programService from '../../../src/services/programService';
import * as attendanceService from '../../../src/services/attendanceService';
import { navigation, resetNavigation, setRoute } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDialogStore } from '../../../src/store/useDialogStore';
import { locales } from '../../../src/i18n/translations';
import CoachStudentScreen from '../../../src/screens/CoachStudentScreen';

const coach = coachService as jest.Mocked<typeof coachService>;
const programs = programService as jest.Mocked<typeof programService>;
const attendance = attendanceService as jest.Mocked<typeof attendanceService>;
const t = locales.pt;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const bruno: StudentSummary = {
  id: 11,
  name: 'Bruno Lima',
  since: daysAgo(60),
  lastWorkoutAt: daysAgo(3),
  sessionsLast7: 2,
  sessionsLast30: 9,
  programDays: 2,
};
const day = (key: string, dayOfWeek: number, title: string, items: number, hidden = false) =>
  ({ key, dayOfWeek, title, items: Array.from({ length: items }, (_, i) => ({ key: `${key}-${i}` })), hidden }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  setRoute({ studentId: 11 }, 'CoachStudent');
  useAppStore.setState({ currentUser: { id: 5, name: 'Ana' } });
  useDialogStore.setState({ alert: null });
  coach.getStudent.mockResolvedValue(bruno);
  programs.loadProgramDraft.mockResolvedValue([day('a', 1, 'Superior A', 5), day('b', 3, 'Inferior', 4), day('c', 5, 'Oculto', 2, true)]);
});

const renderScreen = async () => {
  render(<CoachStudentScreen />);
  await screen.findByText('Superior A');
};

describe('CoachStudentScreen', () => {
  it('loads the student for this coach and shows activity and the visible program days', async () => {
    await renderScreen();
    expect(coach.getStudent).toHaveBeenCalledWith(5, 11);
    expect(programs.loadProgramDraft).toHaveBeenCalledWith(11, { fresh: true });
    expect(attendance.getAttendanceDatesByMonth).toHaveBeenCalledWith(expect.objectContaining({ userId: 11 }));
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
    expect(screen.getByLabelText(`${t.statLast7}: ${t.workoutsCount(2)}`)).toBeTruthy();
    expect(screen.getByLabelText(`${t.statLastWorkout}: ${t.lastWorkoutDays(3)}`)).toBeTruthy();
    expect(screen.getByText(t.dayLabels[1])).toBeTruthy();
    expect(screen.getByText(t.exercisesCount(5))).toBeTruthy();
    // Hidden (unselected) days are not shown.
    expect(screen.queryByText('Oculto')).toBeNull();
  });

  it('opens the program editor and the loads progress for this student', async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: t.editProgram }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('CoachProgram', { studentId: 11, studentName: 'Bruno Lima' });
    fireEvent.click(screen.getByRole('button', { name: t.viewLoadProgress }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('StudentProgress', { studentId: 11, studentName: 'Bruno Lima' });
  });

  it('offers to build the program when the student has none', async () => {
    programs.loadProgramDraft.mockResolvedValue([]);
    render(<CoachStudentScreen />);
    expect(await screen.findByText(t.studentNoProgram)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.buildProgram })).toBeTruthy();
  });

  it('removing the student asks for confirmation, then unlinks and goes back', async () => {
    coach.unlinkStudent.mockResolvedValue(undefined);
    await renderScreen();
    fireEvent.click(screen.getByText(t.removeStudent));
    expect(screen.getByText(t.removeStudentTitle('Bruno Lima'))).toBeTruthy();
    expect(coach.unlinkStudent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(t.removeStudentConfirm));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(coach.unlinkStudent).toHaveBeenCalledWith(11);
  });

  it('a failed removal stays on the page and tells the coach', async () => {
    coach.unlinkStudent.mockRejectedValue(new Error('permission denied'));
    await renderScreen();
    fireEvent.click(screen.getByText(t.removeStudent));
    fireEvent.click(screen.getByText(t.removeStudentConfirm));
    await waitFor(() => expect(useDialogStore.getState().alert?.title).toBe(t.saveError));
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('a student not linked to this coach shows "not found" and no actions', async () => {
    coach.getStudent.mockResolvedValue(null);
    render(<CoachStudentScreen />);
    expect(await screen.findByText(t.studentNotFound)).toBeTruthy();
    expect(screen.queryByText(t.removeStudent)).toBeNull();
    expect(screen.queryByRole('button', { name: t.editProgram })).toBeNull();
    expect(screen.queryByRole('button', { name: t.buildProgram })).toBeNull();
  });
});
