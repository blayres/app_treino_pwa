import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/coachService', () => ({
  getCachedCoachCode: jest.fn(() => undefined),
  getCoachCode: jest.fn(),
}));
jest.mock('../../../src/services/tours', () => ({
  getSeenTours: jest.fn(async () => []),
  saveSeenTours: jest.fn(async () => undefined),
  withTourSeen: jest.fn((seen: string[], tour: string) => [...seen, tour]),
}));

// Children that fetch their own data are replaced by stubs showing what they received.
const mockCalendarRefresh = jest.fn();
jest.mock('../../../src/components/CalendarFrequency', () => {
  const { forwardRef, useEffect, useImperativeHandle } = require('react');
  const CalendarFrequency = forwardRef(({ userId, onLoad }: any, ref: any) => {
    useImperativeHandle(ref, () => ({ refresh: mockCalendarRefresh }), []);
    useEffect(() => {
      onLoad(3, 4);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <span>calendar-of-{userId}</span>;
  });
  CalendarFrequency.displayName = 'CalendarFrequencyStub';
  return { CalendarFrequency };
});
jest.mock('../../../src/components/DayWorkouts', () => ({
  DayWorkouts: ({ userId, refreshKey }: any) => <span>days-of-{userId}-refresh-{refreshKey}</span>,
}));
jest.mock('../../../src/components/ProgramUpdateReminder', () => ({
  ProgramUpdateReminder: ({ onUpdate }: any) => <button onClick={onUpdate}>reminder-update</button>,
}));

import * as coachService from '../../../src/services/coachService';
import { navigation, resetNavigation } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import { useTourStore } from '../../../src/store/useTourStore';
import HomeScreen from '../../../src/screens/HomeScreen';

const coach = coachService as jest.Mocked<typeof coachService>;

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  sessionStorage.clear();
  useAppStore.setState({ currentUser: { id: 5, name: 'Ana' }, activeSession: null });
  useTourStore.setState({ userId: 5, seen: ['home', 'workout'], active: null });
  coach.getCoachCode.mockResolvedValue(null);
});

const renderScreen = async () => {
  render(<HomeScreen />);
  expect(coach.getCoachCode).toHaveBeenCalledWith(5);
  // Let the coach lookup settle.
  await act(async () => {});
};

describe('HomeScreen', () => {
  it('greets the user and gives the data cards the user id; shows the check-in count once loaded', async () => {
    await renderScreen();
    expect(screen.getByText('Olá, Ana')).toBeTruthy();
    expect(screen.getByText('Treinos da semana')).toBeTruthy();
    expect(screen.getByText('days-of-5-refresh-0')).toBeTruthy();
    expect(screen.getByText('calendar-of-5')).toBeTruthy();
    expect(screen.getByText('3/4')).toBeTruthy();
  });

  it('a user who is not a coach does not see the "Alunos" shortcut', async () => {
    await renderScreen();
    expect(screen.queryByRole('button', { name: 'Área do personal' })).toBeNull();
  });

  it('a coach sees the "Alunos" shortcut, which opens the coach area', async () => {
    coach.getCoachCode.mockResolvedValue('ABC123');
    await renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Área do personal' }));
    expect(navigation.navigate).toHaveBeenCalledWith('Coach');
  });

  it('navigates to settings, progress and the program editor', async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Settings');

    fireEvent.click(screen.getByText('Ver meu progresso'));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Progress');

    // Pencil icon on "Treinos da semana" and the card button both edit the program.
    const editButtons = screen.getAllByRole('button', { name: 'Editar meu treino' });
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
    editButtons.forEach((button) => {
      navigation.navigate.mockClear();
      fireEvent.click(button);
      expect(navigation.navigate).toHaveBeenCalledWith('MyWorkout');
    });

    navigation.navigate.mockClear();
    fireEvent.click(screen.getByText('reminder-update'));
    expect(navigation.navigate).toHaveBeenCalledWith('MyWorkout');
  });

  it('after a finished workout, refreshes the cards and shows the "completed" toast once', async () => {
    await renderScreen();
    sessionStorage.setItem('workoutCompletedToast', 'true');
    jest.useFakeTimers();
    try {
      act(() => {
        document.dispatchEvent(new Event('workoutSessionUpdated'));
      });
      expect(screen.getByText('✓ Parabéns! Treino concluído')).toBeTruthy();
      expect(sessionStorage.getItem('workoutCompletedToast')).toBeNull();
      expect(screen.getByText('days-of-5-refresh-1')).toBeTruthy();
      expect(mockCalendarRefresh).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByText('✓ Parabéns! Treino concluído')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a session update without a finished workout refreshes the cards but shows no toast', async () => {
    await renderScreen();
    act(() => {
      document.dispatchEvent(new Event('workoutSessionUpdated'));
    });
    expect(screen.getByText('days-of-5-refresh-1')).toBeTruthy();
    expect(screen.queryByText('✓ Parabéns! Treino concluído')).toBeNull();
  });

  it('starts the guided tour for a user who has not seen it', async () => {
    useTourStore.setState({ seen: [], active: null });
    jest.useFakeTimers();
    try {
      render(<HomeScreen />);
      await act(async () => {});
      expect(useTourStore.getState().active).toBeNull();
      act(() => {
        jest.advanceTimersByTime(900);
      });
      expect(useTourStore.getState().active).toBe('home');
    } finally {
      jest.useRealTimers();
    }
  });
});
