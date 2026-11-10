import { describe, expect, it, jest } from '@jest/globals';

const workouts = [
  { id: 2, user_id: 5, day_of_week: 3, title: 'B', last_done: null },
  { id: 1, user_id: 5, day_of_week: 1, title: 'A', last_done: null },
];
const exercise = (id: number) => ({ id, name: `Ex ${id}`, scheme: '3x10', rest_seconds: 60, primary_muscle: null, secondary_muscle: null, tip: null, exercise_library_id: null });
const rowsByWorkout: Record<number, any[] | null> = {
  1: [{ id: 10, workout_id: 1, exercise_id: 7, order_index: 0, exercise: exercise(7) }],
  2: [{ id: 11, workout_id: 2, exercise_id: 8, order_index: 0, exercise: exercise(8), notes: 'Devagar' }],
};

jest.mock('../src/services/workoutService', () => ({
  getCachedWorkoutsByUser: jest.fn(() => workouts),
  getCachedWorkoutExercises: jest.fn((id: number) => rowsByWorkout[id]),
  getWorkoutsByUser: jest.fn(),
  getWorkoutExercises: jest.fn(),
  invalidateWorkoutsByUserCache: jest.fn(),
  invalidateWorkoutExercisesCache: jest.fn(),
}));

import { peekProgramDraft } from '../src/services/programService';

describe('peekProgramDraft', () => {
  it('builds the editor draft from cached data, sorted by weekday', () => {
    const draft = peekProgramDraft(5)!;
    expect(draft.map((d) => [d.dayOfWeek, d.title, d.items.map((i) => i.name)])).toEqual([
      [1, 'A', ['Ex 7']],
      [3, 'B', ['Ex 8']],
    ]);
    expect(draft[1].items[0].notes).toBe('Devagar');
  });

  it('is null when any workout is missing from the cache (the screen then loads)', () => {
    rowsByWorkout[2] = null;
    expect(peekProgramDraft(5)).toBeNull();
  });
});
