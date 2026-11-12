import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/workoutService', () => ({
  getWorkoutTitle: jest.fn(),
  getWorkoutExercises: jest.fn(),
  getExerciseLoadsByUser: jest.fn(),
  upsertExerciseLoad: jest.fn(),
  getCachedWorkoutExercises: jest.fn(() => null),
  getCachedExerciseLoads: jest.fn(() => null),
}));
jest.mock('../../../src/services/sessionService', () => ({
  FORGOTTEN_SESSION_SECONDS: 4 * 3600,
  isForgottenSession: jest.fn(() => false),
  startWorkoutSession: jest.fn(),
}));
jest.mock('../../../src/services/sessionFinisher', () => ({
  clearSessionChecklist: jest.fn(),
  persistSessionEnd: jest.fn(),
}));
jest.mock('../../../src/services/substituteService', () => ({ getExerciseSubstitutes: jest.fn(async () => []) }));

import * as workoutService from '../../../src/services/workoutService';
import * as sessionService from '../../../src/services/sessionService';
import * as sessionFinisher from '../../../src/services/sessionFinisher';
import { navigation, resetNavigation, setRoute } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import WorkoutScreen from '../../../src/screens/WorkoutScreen';

const workouts = workoutService as jest.Mocked<typeof workoutService>;
const sessions = sessionService as jest.Mocked<typeof sessionService>;
const finisher = sessionFinisher as jest.Mocked<typeof sessionFinisher>;

const exercise = (id: number, name: string, scheme: string) =>
  ({ id, name, scheme, rest_seconds: 60, tip: null, primary_muscle: null, secondary_muscle: null, exercise_library_id: null, library: null }) as any;
const supino = exercise(1, 'Supino na Máquina', '3x8-12');
const prancha = exercise(2, 'Prancha', '3x30-45s');

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  localStorage.clear();
  sessionStorage.clear();
  setRoute({ workoutId: 10, workoutTitle: 'Superior A' }, 'Workout');
  useAppStore.setState({ currentUser: { id: 5, name: 'Ana' }, activeSession: null });
  workouts.getWorkoutTitle.mockResolvedValue('Superior A');
  workouts.getWorkoutExercises.mockResolvedValue([
    { id: 100, exercise: supino },
    { id: 101, exercise: prancha },
  ] as any);
  workouts.getExerciseLoadsByUser.mockResolvedValue([{ exercise_id: 1, load_kg: 43.5, progression_kg: 2 }]);
  workouts.upsertExerciseLoad.mockResolvedValue(undefined as any);
  finisher.persistSessionEnd.mockResolvedValue(undefined as any);
});

const renderScreen = async () => {
  render(<WorkoutScreen />);
  await screen.findByText('Supino na Máquina');
};

describe('WorkoutScreen', () => {
  it('shows the workout, the saved loads (pt decimal comma) and a time input for timed exercises', async () => {
    await renderScreen();
    expect(screen.getByText('Superior A')).toBeTruthy();
    expect((screen.getByLabelText('Supino na Máquina · Carga (kg)') as HTMLInputElement).value).toBe('43,5');
    expect((screen.getByLabelText('Supino na Máquina · Progressão') as HTMLInputElement).value).toBe('2');
    expect(screen.getByLabelText('Prancha · Tempo (s)')).toBeTruthy();
    expect(screen.queryByLabelText('Prancha · Carga (kg)')).toBeNull();
    expect(workouts.getExerciseLoadsByUser).toHaveBeenCalledWith(5);
  });

  it('saves a typed load after a pause, and records it in the history only on blur', async () => {
    await renderScreen();
    jest.useFakeTimers();
    try {
      const input = screen.getByLabelText('Supino na Máquina · Carga (kg)');
      fireEvent.change(input, { target: { value: '45,5' } });
      expect(workouts.upsertExerciseLoad).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(700);
      });
      expect(workouts.upsertExerciseLoad).toHaveBeenLastCalledWith({
        userId: 5, exerciseId: 1, loadKg: 45.5, progressionKg: 2, recordHistory: false,
      });
      fireEvent.blur(input);
      expect(workouts.upsertExerciseLoad).toHaveBeenLastCalledWith(expect.objectContaining({ loadKg: 45.5, recordHistory: true }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('saves the hold time of a timed exercise but never adds it to the load history', async () => {
    await renderScreen();
    const input = screen.getByLabelText('Prancha · Tempo (s)');
    fireEvent.change(input, { target: { value: '60' } });
    fireEvent.blur(input);
    // Blur flushes the pending save without a history entry.
    expect(workouts.upsertExerciseLoad).toHaveBeenLastCalledWith({
      userId: 5, exerciseId: 2, loadKg: 60, progressionKg: null, recordHistory: false,
    });
  });

  it('starting a session shows checkboxes; checking an exercise is remembered for the workout', async () => {
    sessions.startWorkoutSession.mockResolvedValue({ sessionId: 9, workoutId: 10, startedAt: new Date().toISOString(), isRunning: true });
    await renderScreen();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar treino' }));
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2));
    expect(sessions.startWorkoutSession).toHaveBeenCalledWith(5, 10);
    expect(useAppStore.getState().activeSession?.sessionId).toBe(9);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Supino na Máquina' }));
    expect(screen.getByRole('checkbox', { name: 'Supino na Máquina' }).getAttribute('aria-checked')).toBe('true');
    expect(JSON.parse(localStorage.getItem('completedIds:10')!)).toEqual([1]);
  });

  it('finishing asks for confirmation, then goes back and saves the session in the background', async () => {
    const session = { sessionId: 9, workoutId: 10, startedAt: new Date().toISOString(), isRunning: true };
    useAppStore.setState({ activeSession: session });
    await renderScreen();
    fireEvent.click(screen.getByText('Finalizar'));
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(await screen.findByText('Finalizar treino?')).toBeTruthy();
    // The modal's confirm button is the last "Finalizar" on screen.
    fireEvent.click(screen.getAllByText('Finalizar').at(-1)!);
    expect(navigation.goBack).toHaveBeenCalled();
    expect(finisher.persistSessionEnd).toHaveBeenCalledWith({ userId: 5, session, cancelOnly: false });
    expect(useAppStore.getState().activeSession).toBeNull();
    expect(sessionStorage.getItem('workoutCompletedToast')).toBe('true');
  });

  it('discarding a session asks for confirmation and saves it as cancelled (no "completed" toast)', async () => {
    const session = { sessionId: 9, workoutId: 10, startedAt: new Date().toISOString(), isRunning: true };
    useAppStore.setState({ activeSession: session });
    await renderScreen();
    fireEvent.click(screen.getByText('Descartar treino'));
    fireEvent.click(await screen.findByText('Descartar'));
    expect(finisher.persistSessionEnd).toHaveBeenCalledWith({ userId: 5, session, cancelOnly: true });
    expect(sessionStorage.getItem('workoutCompletedToast')).toBeNull();
  });

  it('restores the checklist of a session in progress', async () => {
    localStorage.setItem('completedIds:10', JSON.stringify([2]));
    useAppStore.setState({ activeSession: { sessionId: 9, workoutId: 10, startedAt: new Date().toISOString(), isRunning: true } });
    await renderScreen();
    // A completed exercise hides its details (inputs).
    expect(screen.queryByLabelText('Prancha · Tempo (s)')).toBeNull();
    expect(screen.getByLabelText('Supino na Máquina · Carga (kg)')).toBeTruthy();
  });
});
