import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockBackendMode: 'supabase' | 'local' = 'supabase';
jest.mock('../src/services/backendMode', () => ({
  get backendMode() {
    return mockBackendMode;
  },
  hasSupabaseConfig: true,
}));
jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/progressService', () => ({ recordLoadHistory: jest.fn(async () => undefined) }));
const mockDb = {
  getAllAsync: jest.fn(async (..._args: unknown[]) => [] as any[]),
  getFirstAsync: jest.fn(async (..._args: unknown[]) => null as any),
  runAsync: jest.fn(async (..._args: unknown[]) => ({ lastInsertRowId: 1 }) as any),
  execAsync: jest.fn(async (..._args: unknown[]) => undefined),
};
jest.mock('../src/db', () => ({ getDb: async () => mockDb }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  createCustomExercise,
  createWorkoutForUser,
  deleteCustomExercise,
  ExerciseInUseError,
  getCachedExerciseLoads,
  getCachedWorkoutExercises,
  getCachedWorkoutsByUser,
  getExerciseLoadsByUser,
  getWorkoutExercises,
  getWorkoutsByUser,
  getWorkoutTitle,
  invalidateWorkoutExercisesCache,
  invalidateWorkoutsByUserCache,
  listExercises,
  moveWorkoutsToDays,
  replaceWorkoutItems,
  updateWorkoutTitle,
  upsertExerciseLoad,
  archiveWorkout,
} from '../src/services/workoutService';
import { recordLoadHistory } from '../src/services/progressService';

const history = recordLoadHistory as jest.MockedFunction<typeof recordLoadHistory>;
// The loads cache has no public invalidation for every user: each test uses its own user id.
let nextUserId = 1000;
const freshUser = () => nextUserId++;

beforeEach(() => {
  mockBackendMode = 'supabase';
  supabaseMock.reset();
  invalidateWorkoutExercisesCache();
  invalidateWorkoutsByUserCache();
  history.mockClear();
  Object.values(mockDb).forEach((fn) => fn.mockClear());
});

describe('getWorkoutTitle', () => {
  it('reads the title of that workout id and rethrows errors', async () => {
    supabaseMock.queue('workouts.select', { data: { title: 'Pernas' } });
    expect(await getWorkoutTitle(4)).toBe('Pernas');
    expect(filter(supabaseMock.calls('workouts', 'select')[0], 'eq', 'id')).toEqual(['eq', 'id', 4]);

    supabaseMock.queue('workouts.select', { error: { message: 'nope' } });
    await expect(getWorkoutTitle(4)).rejects.toEqual({ message: 'nope' });
  });
});

describe('getWorkoutsByUser', () => {
  it('reads only that user\'s workouts and last-done rows, excluding archived ones', async () => {
    const userId = freshUser();
    supabaseMock.queue('workouts.select', { data: [{ id: 1, day_of_week: 1, archived_at: null }] });
    await getWorkoutsByUser(userId);

    const [workouts] = supabaseMock.calls('workouts', 'select');
    expect(filter(workouts, 'eq', 'user_id')).toEqual(['eq', 'user_id', userId]);
    expect(filter(workouts, 'is', 'archived_at')).toEqual(['is', 'archived_at', null]);
    expect(filter(supabaseMock.calls('workout_last_done', 'select')[0], 'eq', 'user_id')).toEqual([
      'eq',
      'user_id',
      userId,
    ]);
  });

  it('fallback to completed sessions is also scoped to the user', async () => {
    const userId = freshUser();
    supabaseMock.queue('workout_last_done.select', { error: { message: 'relation does not exist' } });
    await getWorkoutsByUser(userId);
    const [sessions] = supabaseMock.calls('workout_sessions', 'select');
    expect(filter(sessions, 'eq', 'user_id')).toEqual(['eq', 'user_id', userId]);
    expect(filter(sessions, 'eq', 'completed')).toEqual(['eq', 'completed', 1]);
  });

  it('before the archive migration, retries without archived_at; still hides archived rows client-side', async () => {
    const userId = freshUser();
    supabaseMock.queue(
      'workouts.select',
      { error: { code: '42703', message: 'column archived_at does not exist' } },
      { data: [{ id: 1, archived_at: null }, { id: 2, archived_at: '2026-01-01' }] },
    );
    const list = await getWorkoutsByUser(userId);
    expect(list.map((w) => w.id)).toEqual([1]);
    const second = supabaseMock.calls('workouts', 'select')[1];
    expect(filter(second, 'is', 'archived_at')).toBeUndefined();
    expect(filter(second, 'eq', 'user_id')).toEqual(['eq', 'user_id', userId]);
  });

  it('propagates errors and does not cache a failed read', async () => {
    const userId = freshUser();
    supabaseMock.queue('workouts.select', { error: { code: '500', message: 'down' } });
    await expect(getWorkoutsByUser(userId)).rejects.toMatchObject({ message: 'down' });
    expect(getCachedWorkoutsByUser(userId)).toBeNull();

    supabaseMock.queue('workout_last_done.select', { error: { message: 'no view' } });
    supabaseMock.queue('workout_sessions.select', { error: { message: 'denied' } });
    await expect(getWorkoutsByUser(userId)).rejects.toEqual({ message: 'denied' });
  });

  it('fresh: reads again even when cached', async () => {
    const userId = freshUser();
    await getWorkoutsByUser(userId);
    await getWorkoutsByUser(userId);
    expect(supabaseMock.calls('workouts', 'select')).toHaveLength(1);
    await getWorkoutsByUser(userId, { fresh: true });
    expect(supabaseMock.calls('workouts', 'select')).toHaveLength(2);
  });
});

describe('updateWorkoutTitle', () => {
  it('updates that workout and fails when RLS hides it', async () => {
    supabaseMock.queue('workouts.update', { data: { id: 3 } });
    await updateWorkoutTitle(3, 'Costas');
    const [update] = supabaseMock.calls('workouts', 'update');
    expect(update.payload).toEqual({ title: 'Costas' });
    expect(filter(update, 'eq', 'id')).toEqual(['eq', 'id', 3]);

    supabaseMock.queue('workouts.update', { data: null });
    await expect(updateWorkoutTitle(3, 'x')).rejects.toThrow('sem permissão');

    supabaseMock.queue('workouts.update', { error: { message: 'boom' } });
    await expect(updateWorkoutTitle(3, 'x')).rejects.toEqual({ message: 'boom' });
  });
});

describe('archiveWorkout errors', () => {
  it('rethrows the database error', async () => {
    supabaseMock.queue('workouts.update', { error: { message: 'boom' } });
    await expect(archiveWorkout(3)).rejects.toEqual({ message: 'boom' });
  });
});

describe('replaceWorkoutItems', () => {
  it('deletes only the old rows of that workout (by id) and refreshes the cached exercises', async () => {
    supabaseMock.queue('workout_exercises.select', { data: [{ id: 1, workout_id: 7, exercise_id: 1, order_index: 0, exercises: { id: 1, name: 'A', scheme: '3x10', rest_seconds: 60 } }] });
    await getWorkoutExercises(7);
    expect(getCachedWorkoutExercises(7)).toHaveLength(1);

    supabaseMock.queue('workout_exercises.select', { data: [{ id: 11, order_index: 0 }, { id: 12, order_index: 1 }] });
    await replaceWorkoutItems(7, [{ exerciseId: 5 }]);

    const [oldRows] = supabaseMock.calls('workout_exercises', 'select').slice(-1);
    expect(filter(oldRows, 'eq', 'workout_id')).toEqual(['eq', 'workout_id', 7]);
    const [del] = supabaseMock.calls('workout_exercises', 'delete');
    expect(del.chain).toEqual([['in', 'id', [11, 12]]]);
    expect(getCachedWorkoutExercises(7)).toBeNull();
  });

  it('an empty list just removes the old rows (nothing inserted)', async () => {
    supabaseMock.queue('workout_exercises.select', { data: [{ id: 11, order_index: 0 }] });
    await replaceWorkoutItems(7, []);
    expect(supabaseMock.calls('workout_exercises', 'insert')).toHaveLength(0);
    expect(supabaseMock.calls('workout_exercises', 'delete')).toHaveLength(1);
  });

  it('stops before writing when the old rows cannot be read', async () => {
    supabaseMock.queue('workout_exercises.select', { error: { message: 'denied' } });
    await expect(replaceWorkoutItems(7, [{ exerciseId: 5 }])).rejects.toEqual({ message: 'denied' });
    expect(supabaseMock.calls('workout_exercises', 'insert')).toHaveLength(0);
    expect(supabaseMock.calls('workout_exercises', 'delete')).toHaveLength(0);
  });

  it('a failed delete of the old rows removes the new ones again (no duplicated exercises)', async () => {
    supabaseMock.queue('workout_exercises.select', { data: [{ id: 11, order_index: 0 }] });
    supabaseMock.queue('workout_exercises.insert', { data: [{ id: 21 }, { id: 22 }] });
    supabaseMock.queue('workout_exercises.delete', { error: { message: 'delete failed' } }, { data: null });
    await expect(replaceWorkoutItems(7, [{ exerciseId: 5 }, { exerciseId: 6 }])).rejects.toEqual({ message: 'delete failed' });
    const deletes = supabaseMock.calls('workout_exercises', 'delete');
    expect(deletes).toHaveLength(2);
    expect(filter(deletes[0], 'in', 'id')?.[2]).toEqual([11]);
    expect(filter(deletes[1], 'in', 'id')?.[2]).toEqual([21, 22]);
  });

  it('local mode: inserts above the old order, then deletes the old rows', async () => {
    mockBackendMode = 'local';
    mockDb.getAllAsync.mockResolvedValueOnce([{ id: 11, order_index: 4 }]);
    await replaceWorkoutItems(7, [{ exerciseId: 5, scheme: '3x8' }]);
    const [insert, del] = mockDb.runAsync.mock.calls;
    expect(insert.slice(1)).toEqual([7, 5, 5, '3x8', null, null]);
    expect(del).toEqual(['DELETE FROM workout_exercises WHERE id = ?;', 11]);
  });
});

describe('getWorkoutExercises base fallback', () => {
  it('when every enriched query fails, uses the minimal columns', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const err = { error: { message: 'missing column' } };
    supabaseMock.queue('workout_exercises.select', err, err, err, {
      data: [{ id: 1, workout_id: 9, exercise_id: 2, order_index: 0, exercises: { id: 2, name: 'Agachamento', scheme: '4x8', rest_seconds: '90' } }],
    });
    const [row] = await getWorkoutExercises(9);
    expect(row.exercise).toMatchObject({ name: 'Agachamento', scheme: '4x8', rest_seconds: 90, tip: null });
    expect(supabaseMock.calls('workout_exercises', 'select').every((q) => filter(q, 'eq', 'workout_id')?.[2] === 9)).toBe(true);
    warn.mockRestore();
  });

  it('throws when even the fallback fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const err = { error: { message: 'down' } };
    supabaseMock.queue('workout_exercises.select', err, err, err, err);
    await expect(getWorkoutExercises(9)).rejects.toEqual({ message: 'down' });
    warn.mockRestore();
  });

  it('local mode maps per-workout overrides over the catalogue values', async () => {
    mockBackendMode = 'local';
    mockDb.getAllAsync.mockResolvedValueOnce([
      { we_id: 1, workout_id: 9, exercise_id: 2, order_index: 0, we_scheme: '5x5', we_rest_seconds: null, we_notes: 'Devagar', id: 2, name: 'Supino', scheme: '3x10', rest_seconds: 60, tip: 'x' },
    ]);
    const [row] = await getWorkoutExercises(9);
    expect(row.exercise).toMatchObject({ scheme: '5x5', rest_seconds: 60, tip: 'Devagar' });
    expect(row).toMatchObject({ base_scheme: '3x10', scheme_override: '5x5', notes: 'Devagar' });
  });
});

describe('exercise loads', () => {
  it('reads only the user\'s loads, once (cached)', async () => {
    const userId = freshUser();
    supabaseMock.queue('exercise_loads.select', { data: [{ exercise_id: 1, load_kg: 20, progression_kg: null }] });
    expect(await getExerciseLoadsByUser(userId)).toHaveLength(1);
    await getExerciseLoadsByUser(userId);
    const calls = supabaseMock.calls('exercise_loads', 'select');
    expect(calls).toHaveLength(1);
    expect(calls[0].chain).toEqual([['eq', 'user_id', userId]]);
  });

  it('a typed load replaces that exercise in the cached loads', async () => {
    const userId = freshUser();
    supabaseMock.queue('exercise_loads.select', {
      data: [
        { exercise_id: 1, load_kg: 20, progression_kg: null },
        { exercise_id: 2, load_kg: 30, progression_kg: null },
      ],
    });
    await getExerciseLoadsByUser(userId);
    await upsertExerciseLoad({ userId, exerciseId: 1, loadKg: 22.5, progressionKg: 25, recordHistory: false });
    expect(getCachedExerciseLoads(userId)).toEqual([
      { exercise_id: 2, load_kg: 30, progression_kg: null },
      { exercise_id: 1, load_kg: 22.5, progression_kg: 25 },
    ]);
  });

  it('a failed save is reported and not recorded in the history', async () => {
    supabaseMock.queue('exercise_loads.upsert', { error: { message: 'denied' } });
    await expect(upsertExerciseLoad({ userId: freshUser(), exerciseId: 1, loadKg: 20, progressionKg: null })).rejects.toEqual({
      message: 'denied',
    });
    expect(history).not.toHaveBeenCalled();
  });

  it('local mode saves with ON CONFLICT and records positive loads in the history', async () => {
    mockBackendMode = 'local';
    const userId = freshUser();
    await upsertExerciseLoad({ userId, exerciseId: 3, loadKg: 10, progressionKg: null });
    expect(mockDb.runAsync.mock.calls[0].slice(1, 4)).toEqual([userId, 3, 10]);
    expect(history).toHaveBeenCalledWith({ userId, exerciseId: 3, loadKg: 10 });

    history.mockClear();
    await upsertExerciseLoad({ userId, exerciseId: 3, loadKg: 0, progressionKg: null });
    expect(history).not.toHaveBeenCalled();
  });
});

describe('listExercises', () => {
  it('supabase: lets RLS filter, sorted by name; rethrows errors', async () => {
    supabaseMock.queue('exercises.select', { data: [{ id: 1 }] });
    expect(await listExercises(3)).toEqual([{ id: 1 }]);
    expect(supabaseMock.calls('exercises', 'select')[0].chain).toEqual([['order', 'name', { ascending: true }]]);
    supabaseMock.queue('exercises.select', { error: { message: 'x' } });
    await expect(listExercises()).rejects.toEqual({ message: 'x' });
  });

  it('local: catalogue + only that user\'s private exercises', async () => {
    mockBackendMode = 'local';
    await listExercises(3);
    expect(mockDb.getAllAsync).toHaveBeenLastCalledWith(expect.stringContaining('owner_id IS NULL OR owner_id = ?'), 3);
    await listExercises();
    expect(mockDb.getAllAsync).toHaveBeenLastCalledWith(expect.stringContaining('WHERE owner_id IS NULL ORDER'));
  });
});

describe('custom exercises', () => {
  it('on a duplicate name, looks up only the user\'s own exercise', async () => {
    supabaseMock.queue('exercises.insert', { error: { code: '23505', message: 'duplicate' } });
    supabaseMock.queue('exercises.select', { data: { id: 4, name: 'Remada' } });
    await createCustomExercise({ userId: 8, name: 'Remada' });
    const [lookup] = supabaseMock.calls('exercises', 'select');
    expect(filter(lookup, 'eq', 'owner_id')).toEqual(['eq', 'owner_id', 8]);
  });

  it('duplicate but not found, or lookup failing, rethrows', async () => {
    supabaseMock.queue('exercises.insert', { error: { code: '23505', message: 'duplicate' } });
    await expect(createCustomExercise({ userId: 8, name: 'Remada' })).rejects.toMatchObject({ code: '23505' });

    supabaseMock.queue('exercises.insert', { error: { code: '23505', message: 'duplicate' } });
    supabaseMock.queue('exercises.select', { error: { message: 'lookup failed' } });
    await expect(createCustomExercise({ userId: 8, name: 'Remada' })).rejects.toEqual({ message: 'lookup failed' });

    supabaseMock.queue('exercises.insert', { error: { code: '42501', message: 'denied' } });
    await expect(createCustomExercise({ userId: 8, name: 'Remada' })).rejects.toMatchObject({ code: '42501' });
    // Only the two duplicate errors triggered a lookup.
    expect(supabaseMock.calls('exercises', 'select')).toHaveLength(2);
  });

  it('local: reuses an existing name, otherwise inserts it owned by the user', async () => {
    mockBackendMode = 'local';
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: 3, name: 'Remada' });
    expect(await createCustomExercise({ userId: 8, name: 'remada' })).toEqual({ id: 3, name: 'Remada' });
    expect(mockDb.runAsync).not.toHaveBeenCalled();

    mockDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 42 });
    const created = await createCustomExercise({ userId: 8, name: '  Remada   alta ', scheme: '4x8', restSeconds: 45 });
    expect(created).toMatchObject({ id: 42, name: 'Remada alta', scheme: '4x8', rest_seconds: 45, owner_id: 8 });
    expect(mockDb.runAsync.mock.calls[0].slice(1)).toEqual(['Remada alta', 45, '4x8', 8]);
  });

  it('deleting invalidates the cached loads of that user', async () => {
    const userId = freshUser();
    supabaseMock.queue('exercise_loads.select', { data: [{ exercise_id: 1, load_kg: 20, progression_kg: null }] });
    await getExerciseLoadsByUser(userId);
    await deleteCustomExercise(userId, 1);
    expect(supabaseMock.rpcs).toEqual([{ name: 'delete_own_exercise', args: { p_exercise_id: 1 } }]);
    expect(getCachedExerciseLoads(userId)).toBeNull();
  });

  it('other RPC errors are rethrown as is', async () => {
    supabaseMock.queue('rpc.delete_own_exercise', { error: { message: 'denied' } });
    await expect(deleteCustomExercise(1, 1)).rejects.toEqual({ message: 'denied' });
  });

  it('local: refuses while in an active workout and deletes nothing', async () => {
    mockBackendMode = 'local';
    mockDb.getFirstAsync.mockResolvedValueOnce({ n: 1 });
    await expect(deleteCustomExercise(8, 3)).rejects.toBeInstanceOf(ExerciseInUseError);
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('local: every delete is scoped to the user', async () => {
    mockBackendMode = 'local';
    mockDb.getFirstAsync.mockResolvedValueOnce({ n: 0 });
    await deleteCustomExercise(8, 3);
    const calls = mockDb.runAsync.mock.calls;
    expect(calls).toHaveLength(4);
    calls.forEach((call) => {
      expect(String(call[0])).toMatch(/user_id = \?|owner_id = \?/);
      expect(call.slice(1)).toEqual(expect.arrayContaining([8, 3]));
    });
  });
});

describe('local mode writes', () => {
  beforeEach(() => {
    mockBackendMode = 'local';
  });

  it('createWorkoutForUser inserts the day then each exercise in order', async () => {
    mockDb.runAsync.mockResolvedValueOnce({ lastInsertRowId: 50 });
    expect(await createWorkoutForUser({ userId: 2, dayOfWeek: 3, title: 'A', exerciseIds: [7, 8] })).toBe(50);
    const calls = mockDb.runAsync.mock.calls;
    expect(calls[0].slice(1)).toEqual([2, 3, 'A']);
    expect(calls[1].slice(1)).toEqual([50, 7, 0, null, null, null]);
    expect(calls[2].slice(1)).toEqual([50, 8, 1, null, null, null]);
  });

  it('moveWorkoutsToDays rolls back when a step fails', async () => {
    mockDb.runAsync.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('disk'));
    await expect(moveWorkoutsToDays([{ workoutId: 1, dayOfWeek: 2 }, { workoutId: 2, dayOfWeek: 1 }])).rejects.toThrow('disk');
    expect(mockDb.execAsync.mock.calls.map((c) => c[0])).toEqual(['BEGIN;', 'ROLLBACK;']);
  });

  it('moveWorkoutsToDays commits a swap', async () => {
    await moveWorkoutsToDays([{ workoutId: 1, dayOfWeek: 2 }, { workoutId: 2, dayOfWeek: 1 }]);
    expect(mockDb.execAsync.mock.calls.map((c) => c[0])).toEqual(['BEGIN;', 'COMMIT;']);
    expect(mockDb.runAsync).toHaveBeenCalledTimes(4);
  });

  it('reads title, workouts, loads and archives through SQLite', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    expect(await getWorkoutTitle(1)).toBe('');

    const userId = freshUser();
    mockDb.getAllAsync
      .mockResolvedValueOnce([{ id: 1, day_of_week: 1 }])
      .mockResolvedValueOnce([{ workout_id: 1, last_done: '2026-11-01' }]);
    expect(await getWorkoutsByUser(userId)).toEqual([{ id: 1, day_of_week: 1, last_done: '2026-11-01' }]);
    expect(mockDb.getAllAsync.mock.calls[0][1]).toBe(userId);
    expect(mockDb.getAllAsync.mock.calls[1][1]).toBe(userId);

    mockDb.getAllAsync.mockResolvedValueOnce([{ exercise_id: 1 }]);
    expect(await getExerciseLoadsByUser(userId)).toEqual([{ exercise_id: 1 }]);
    expect(mockDb.getAllAsync).toHaveBeenLastCalledWith(expect.stringContaining('WHERE user_id = ?'), userId);

    await updateWorkoutTitle(1, 'B');
    await archiveWorkout(1);
    expect(mockDb.runAsync.mock.calls.map((c) => c[c.length - 1])).toEqual([1, 1]);
  });
});
