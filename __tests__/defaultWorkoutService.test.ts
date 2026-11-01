import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/workoutService', () => ({
  getWorkoutsByUser: jest.fn(),
  listExercises: jest.fn(),
  createCustomExercise: jest.fn(),
  createWorkoutForUser: jest.fn(),
  invalidateWorkoutsByUserCache: jest.fn(),
}));

import * as workoutService from '../src/services/workoutService';
import { applyDefaultProgram, DEFAULT_PROGRAM } from '../src/services/defaultWorkoutService';

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
      exercise(1, 'cadeira extensora'),           // same name, different case
      exercise(2, 'Leg Press 45°', '4x10-12', 120),
      exercise(3, 'Puxada Alta na Maquina'),      // without accent
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
    // 10 distinct exercises in the program, each created once.
    expect(mocked.createCustomExercise).toHaveBeenCalledTimes(10);
    expect(mocked.createCustomExercise.mock.calls.every(([p]: any) => p.userId === 7)).toBe(true);
  });

  it("keeps the program's own scheme/rest as overrides when the catalogue differs", async () => {
    mocked.listExercises.mockResolvedValue([exercise(1, 'Cadeira Extensora', '3x15', 60)]);
    await applyDefaultProgram(7);
    const monday = mocked.createWorkoutForUser.mock.calls[0][0] as any;
    expect(monday.items[0]).toEqual({ exerciseId: 1, scheme: '4x10-12', restSeconds: 90 });
  });

  it('prefers the global exercise over a private one with the same name', async () => {
    mocked.listExercises.mockResolvedValue([exercise(50, 'Cadeira Extensora', '4x10-12', 90, 7), exercise(1, 'Cadeira Extensora')]);
    await applyDefaultProgram(7);
    expect((mocked.createWorkoutForUser.mock.calls[0][0] as any).items[0].exerciseId).toBe(1);
  });
});
