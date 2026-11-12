import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/workoutService', () => ({
  getWorkoutsByUser: jest.fn(),
  listExercises: jest.fn(),
  createCustomExercise: jest.fn(),
  createWorkoutForUser: jest.fn(),
  invalidateWorkoutsByUserCache: jest.fn(),
}));

import * as workoutService from '../src/services/workoutService';
import { applyDefaultProgram, DEFAULT_PROGRAM, estimateWorkoutMinutes } from '../src/services/defaultWorkoutService';

const mocked = workoutService as jest.Mocked<typeof workoutService>;
const exercise = (id: number, name: string, scheme = '4x10-12', rest = 90, owner_id: number | null = null) =>
  ({ id, name, scheme, rest_seconds: rest, owner_id }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getWorkoutsByUser.mockResolvedValue([]);
  mocked.createWorkoutForUser.mockResolvedValue(1);
  let nextId = 500;
  mocked.createCustomExercise.mockImplementation(async (p: any) => exercise(nextId++, p.name, p.scheme, p.restSeconds, 7));
});

describe('applyDefaultProgram', () => {
  it('does nothing for a user who already has workouts', async () => {
    mocked.getWorkoutsByUser.mockResolvedValue([{ id: 1 } as any]);
    await applyDefaultProgram(7);
    expect(mocked.listExercises).not.toHaveBeenCalled();
    expect(mocked.createWorkoutForUser).not.toHaveBeenCalled();
  });

  it('creates the 5 days reusing catalogue exercises by name (accents/case-insensitive)', async () => {
    mocked.listExercises.mockResolvedValue([
      exercise(1, 'supino reto com halteres'),    // same name, different case
      exercise(2, 'Puxada frente na polia', '3x8-12', 90),
      exercise(3, 'Desenvolvimento na Maquina'),  // without accent
    ]);

    await applyDefaultProgram(7);

    expect(mocked.createWorkoutForUser).toHaveBeenCalledTimes(DEFAULT_PROGRAM.length);
    const monday = mocked.createWorkoutForUser.mock.calls[0][0] as any;
    expect(monday).toMatchObject({ userId: 7, dayOfWeek: 1, title: DEFAULT_PROGRAM[0].title });
    expect(monday.items.slice(0, 3).map((i: any) => i.exerciseId)).toEqual([1, 2, 3]);
  });

  it('creates missing ones as private exercises (users cannot write the global catalogue)', async () => {
    mocked.listExercises.mockResolvedValue([]);
    await applyDefaultProgram(7);
    // Every distinct exercise in the program is created once.
    const distinct = new Set(DEFAULT_PROGRAM.flatMap((day) => day.exercises));
    expect(mocked.createCustomExercise).toHaveBeenCalledTimes(distinct.size);
    expect(mocked.createCustomExercise.mock.calls.every(([p]: any) => p.userId === 7)).toBe(true);
  });

  it("keeps the program's own scheme/rest as overrides when the catalogue differs", async () => {
    mocked.listExercises.mockResolvedValue([exercise(1, 'Supino reto com halteres', '3x15', 60)]);
    await applyDefaultProgram(7);
    const monday = mocked.createWorkoutForUser.mock.calls[0][0] as any;
    expect(monday.items[0]).toEqual({ exerciseId: 1, scheme: '3x8-12', restSeconds: 90 });
  });

  it('prefers the global exercise over a private one with the same name', async () => {
    mocked.listExercises.mockResolvedValue([exercise(50, 'Supino reto com halteres', '3x8-12', 90, 7), exercise(1, 'Supino reto com halteres')]);
    await applyDefaultProgram(7);
    expect((mocked.createWorkoutForUser.mock.calls[0][0] as any).items[0].exerciseId).toBe(1);
  });
});

describe('DEFAULT_PROGRAM', () => {
  it('has 5 to 6 exercises a day, each day fitting in 50 minutes', () => {
    for (const day of DEFAULT_PROGRAM) {
      expect(day.exercises.length).toBeGreaterThanOrEqual(5);
      expect(day.exercises.length).toBeLessThanOrEqual(6);
      expect(estimateWorkoutMinutes(day.exercises)).toBeLessThanOrEqual(50);
    }
  });

  it('trains each weekday once, Monday to Friday', () => {
    expect(DEFAULT_PROGRAM.map((day) => day.day_of_week)).toEqual([1, 2, 3, 4, 5]);
  });
});
