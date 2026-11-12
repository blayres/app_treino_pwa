import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('./helpers/navigationMock'));
jest.mock('../../src/services/workoutService', () => ({
  getWorkoutsByUser: jest.fn(),
  getWorkoutExercises: jest.fn(async () => []),
  getExerciseLoadsByUser: jest.fn(async () => []),
  getCachedWorkoutsByUser: jest.fn(() => null),
}));
// Run the background warm-up right away (and record that it was scheduled).
jest.mock('../../src/utils/idle', () => ({
  prefetchWhenIdle: jest.fn((work: (isCancelled: () => boolean) => unknown) => {
    void work(() => false);
    return () => {};
  }),
}));

import { navigation, resetNavigation } from './helpers/navigationMock';
import {
  getCachedWorkoutsByUser,
  getExerciseLoadsByUser,
  getWorkoutExercises,
  getWorkoutsByUser,
} from '../../src/services/workoutService';
import { DayWorkouts } from '../../src/components/DayWorkouts';
import { useAppStore } from '../../src/store/useAppStore';

const byUser = getWorkoutsByUser as jest.MockedFunction<typeof getWorkoutsByUser>;
const cached = getCachedWorkoutsByUser as jest.MockedFunction<typeof getCachedWorkoutsByUser>;

const daysAgo = (n: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, 10).toISOString();
};
const week = [
  { id: 1, user_id: 5, day_of_week: 1, title: 'Superiores', last_done: daysAgo(0) },
  { id: 2, user_id: 5, day_of_week: 2, title: 'Repouso', last_done: null },
  { id: 3, user_id: 5, day_of_week: 3, title: 'Inferiores', last_done: daysAgo(3) },
] as any[];

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  cached.mockReturnValue(null);
  byUser.mockResolvedValue(week);
  useAppStore.setState({ activeSession: null });
});

const renderList = async (props: Partial<React.ComponentProps<typeof DayWorkouts>> = {}) => {
  const utils = render(<DayWorkouts userId={5} {...props} />);
  await act(async () => {});
  return utils;
};

describe('DayWorkouts', () => {
  it('lists the week for that user with "feito há…"', async () => {
    await renderList();
    expect(byUser).toHaveBeenCalledWith(5);
    expect(screen.getByText('Segunda')).toBeTruthy();
    expect(screen.getByText('Superiores')).toBeTruthy();
    expect(screen.getByText('feito hoje')).toBeTruthy();
    expect(screen.getByText('feito há 3 dias')).toBeTruthy();
  });

  it('tapping a workout opens it at once; a rest day is not clickable', async () => {
    await renderList();
    fireEvent.click(screen.getByText('Inferiores'));
    expect(navigation.navigate).toHaveBeenCalledWith('Workout', { workoutId: 3, workoutTitle: 'Inferiores' });

    navigation.navigate.mockClear();
    fireEvent.click(screen.getByText('Repouso'));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('marks the running workout as "Em andamento"', async () => {
    useAppStore.setState({ activeSession: { sessionId: 9, workoutId: 3, startedAt: daysAgo(0), isRunning: true } });
    await renderList();
    expect(screen.getByRole('button', { name: 'Quarta, Inferiores, Em andamento' })).toBeTruthy();
  });

  it('draws the cached week on the first frame (no skeleton)', () => {
    cached.mockReturnValue(week);
    byUser.mockReturnValue(new Promise(() => {}));
    render(<DayWorkouts userId={5} />);
    expect(screen.getByText('Superiores')).toBeTruthy();
    expect(screen.queryByLabelText('…')).toBeNull();
  });

  it('shows a skeleton on the first load only', async () => {
    byUser.mockReturnValue(new Promise(() => {}));
    render(<DayWorkouts userId={5} />);
    expect(screen.getByLabelText('…')).toBeTruthy();
    expect(screen.queryByText('Superiores')).toBeNull();
  });

  it('keeps the list when a refresh fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = await renderList();
    byUser.mockRejectedValueOnce(new Error('offline'));
    rerender(<DayWorkouts userId={5} refreshKey={1} />);
    await act(async () => {});
    expect(byUser).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Superiores')).toBeTruthy();
    warn.mockRestore();
  });

  it('warms the loads and each workout\'s exercises in the background', async () => {
    await renderList();
    await act(async () => {});
    expect(getExerciseLoadsByUser).toHaveBeenCalledWith(5);
    expect((getWorkoutExercises as jest.Mock).mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });
});
