import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  archiveWorkout,
  createCustomExercise,
  getWorkoutsByUser,
  invalidateWorkoutsByUserCache,
  createWorkoutForUser,
  deleteCustomExercise,
  ExerciseInUseError,
  getWorkoutExercises,
  invalidateWorkoutExercisesCache,
  replaceWorkoutItems,
  upsertExerciseLoad,
} from '../src/services/workoutService';

const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  supabaseMock.reset();
  invalidateWorkoutExercisesCache();
  invalidateWorkoutsByUserCache();
});

describe('getWorkoutsByUser', () => {
  it('lists active days with the date each was last completed', async () => {
    supabaseMock.queue('workouts.select', {
      data: [
        { id: 1, user_id: 5, day_of_week: 1, title: 'A', archived_at: null },
        { id: 2, user_id: 5, day_of_week: 3, title: 'B', archived_at: null },
      ],
    });
    supabaseMock.queue('workout_sessions.select', {
      data: [
        { workout_id: 1, ended_at: '2026-10-01T10:00:00Z' },
        { workout_id: 1, ended_at: '2026-10-20T10:00:00Z' },
      ],
    });

    const days = await getWorkoutsByUser(5);

    expect(days.map((d) => [d.id, d.last_done])).toEqual([[1, '2026-10-20T10:00:00Z'], [2, null]]);
    const [workoutsQuery] = supabaseMock.calls('workouts', 'select');
    expect(filter(workoutsQuery, 'is', 'archived_at')).toEqual(['is', 'archived_at', null]);
    const [sessionsQuery] = supabaseMock.calls('workout_sessions', 'select');
    expect(filter(sessionsQuery, 'eq', 'completed')).toEqual(['eq', 'completed', 1]); // discarded sessions don't count
  });

  it('caches per user until invalidated after a write', async () => {
    supabaseMock.queue('workouts.select', { data: [] }, { data: [] });
    await getWorkoutsByUser(5);
    await getWorkoutsByUser(5);
    expect(supabaseMock.calls('workouts', 'select')).toHaveLength(1);
    invalidateWorkoutsByUserCache(5);
    await getWorkoutsByUser(5);
    expect(supabaseMock.calls('workouts', 'select')).toHaveLength(2);
  });
});

describe('archiveWorkout', () => {
  it('archives (keeps history) instead of deleting', async () => {
    supabaseMock.queue('workouts.update', { data: { id: 40 } });
    await archiveWorkout(40);
    expect(supabaseMock.calls('workouts', 'update')[0].payload).toEqual({ archived_at: expect.any(String) });
    expect(supabaseMock.calls('workouts', 'delete')).toHaveLength(0);
  });

  it('fails loudly when the row is not visible (RLS: not your workout)', async () => {
    supabaseMock.queue('workouts.update', { data: null });
    await expect(archiveWorkout(40)).rejects.toThrow();
  });
});

describe('createWorkoutForUser', () => {
  it('creates the day, then its exercises in order, sending overrides/notes only when set', async () => {
    supabaseMock.queue('workouts.insert', { data: { id: 40 } });

    const id = await createWorkoutForUser({
      userId: 1,
      dayOfWeek: 2,
      title: 'Superiores',
      items: [
        { exerciseId: 10 },
        { exerciseId: 11, scheme: '4x8', restSeconds: 90, notes: 'cadência 2010' },
      ],
    });

    expect(id).toBe(40);
    expect(supabaseMock.calls('workouts', 'insert')[0].payload).toEqual({ user_id: 1, day_of_week: 2, title: 'Superiores' });
    expect(supabaseMock.calls('workout_exercises', 'insert')[0].payload).toEqual([
      { workout_id: 40, exercise_id: 10, order_index: 0 },
      { workout_id: 40, exercise_id: 11, order_index: 1, scheme: '4x8', rest_seconds: 90, notes: 'cadência 2010' },
    ]);
  });

  it('removes the empty day if its exercises fail, so the weekday is not left taken', async () => {
    supabaseMock.queue('workouts.insert', { data: { id: 40 } });
    supabaseMock.queue('workout_exercises.insert', { error: { message: 'fk violation' } });

    await expect(
      createWorkoutForUser({ userId: 1, dayOfWeek: 2, title: 'X', items: [{ exerciseId: 10 }] }),
    ).rejects.toEqual({ message: 'fk violation' });
    const [del] = supabaseMock.calls('workouts', 'delete');
    expect(filter(del, 'eq', 'id')).toEqual(['eq', 'id', 40]);
  });

  it('surfaces the one-workout-per-weekday conflict', async () => {
    supabaseMock.queue('workouts.insert', { error: { code: '23505' } });
    await expect(createWorkoutForUser({ userId: 1, dayOfWeek: 2, title: 'X', items: [] })).rejects.toEqual({ code: '23505' });
    expect(supabaseMock.calls('workout_exercises')).toHaveLength(0);
  });
});

describe('replaceWorkoutItems', () => {
  it('inserts the new list before deleting the old rows (never leaves the day empty)', async () => {
    supabaseMock.queue('workout_exercises.select', { data: [{ id: 1 }, { id: 2 }] });

    await replaceWorkoutItems(40, [{ exerciseId: 10, scheme: '3x12' }]);

    const order = supabaseMock.queries.map((q) => `${q.table}.${q.action}`);
    expect(order).toEqual(['workout_exercises.select', 'workout_exercises.insert', 'workout_exercises.delete']);
    expect(supabaseMock.calls('workout_exercises', 'insert')[0].payload).toEqual([
      { workout_id: 40, exercise_id: 10, order_index: 0, scheme: '3x12', rest_seconds: null },
    ]);
    expect(filter(supabaseMock.calls('workout_exercises', 'delete')[0], 'in', 'id')).toEqual(['in', 'id', [1, 2]]);
  });

  it('keeps the old rows when inserting the new ones fails', async () => {
    supabaseMock.queue('workout_exercises.select', { data: [{ id: 1 }] });
    supabaseMock.queue('workout_exercises.insert', { error: { message: 'boom' } });
    await expect(replaceWorkoutItems(40, [{ exerciseId: 10 }])).rejects.toEqual({ message: 'boom' });
    expect(supabaseMock.calls('workout_exercises', 'delete')).toHaveLength(0);
  });
});

describe('getWorkoutExercises', () => {
  const exercise = { id: 10, name: 'Supino', primary_muscle: 'peito', secondary_muscle: null, rest_seconds: 60, scheme: '3x10-12', tip: 'Dica geral', exercise_library_id: null, exercise_library: null };

  it('applies per-workout scheme/rest overrides and shows coach notes instead of the generic tip', async () => {
    supabaseMock.queue('workout_exercises.select', {
      data: [{ id: 1, workout_id: 40, exercise_id: 10, order_index: 0, scheme: '4x8', rest_seconds: 90, notes: 'Cadência 2010', exercises: exercise }],
    });

    const [row] = await getWorkoutExercises(40);

    expect(row.exercise).toMatchObject({ scheme: '4x8', rest_seconds: 90, tip: 'Cadência 2010' });
    expect(row).toMatchObject({ base_scheme: '3x10-12', base_rest_seconds: 60, scheme_override: '4x8', notes: 'Cadência 2010' });
  });

  it('falls back to the catalogue values when there is no override', async () => {
    supabaseMock.queue('workout_exercises.select', {
      data: [{ id: 1, workout_id: 40, exercise_id: 10, order_index: 0, scheme: null, rest_seconds: null, notes: null, exercises: exercise }],
    });
    const [row] = await getWorkoutExercises(40);
    expect(row.exercise).toMatchObject({ scheme: '3x10-12', rest_seconds: 60, tip: 'Dica geral' });
  });

  it('retries without the newer columns if a migration is missing', async () => {
    supabaseMock.queue(
      'workout_exercises.select',
      { error: { code: '42703' } },
      { data: [{ id: 1, workout_id: 40, exercise_id: 10, order_index: 0, scheme: null, rest_seconds: null, exercises: exercise }] },
    );
    const rows = await getWorkoutExercises(40);
    expect(rows).toHaveLength(1);
    const [first, second] = supabaseMock.calls('workout_exercises', 'select').map((q) => String(q.payload));
    expect(first).toContain('notes');
    expect(second).not.toContain('notes');
  });
});

describe('custom exercises', () => {
  it('creates a private exercise with a clean name and sensible defaults', async () => {
    supabaseMock.queue('exercises.insert', { data: { id: 99, name: 'Remada cavalinho' } });

    await createCustomExercise({ userId: 5, name: '  Remada   cavalinho ' });

    expect(supabaseMock.calls('exercises', 'insert')[0].payload).toEqual({
      name: 'Remada cavalinho',
      scheme: '3x10-12',
      rest_seconds: 60,
      owner_id: 5,
    });
  });

  it('reuses the existing one when the user already created that name', async () => {
    supabaseMock.queue('exercises.insert', { error: { code: '23505' } });
    supabaseMock.queue('exercises.select', { data: { id: 99, name: 'Remada cavalinho' } });

    expect(await createCustomExercise({ userId: 5, name: 'remada cavalinho' })).toMatchObject({ id: 99 });
    const [lookup] = supabaseMock.calls('exercises', 'select');
    expect(filter(lookup, 'eq', 'owner_id')).toEqual(['eq', 'owner_id', 5]);
  });

  it('rejects an empty name', async () => {
    await expect(createCustomExercise({ userId: 5, name: '   ' })).rejects.toThrow();
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('deletes through the RPC and explains when the exercise is still in a workout', async () => {
    await deleteCustomExercise(5, 99);
    expect(supabaseMock.rpcs).toEqual([{ name: 'delete_own_exercise', args: { p_exercise_id: 99 } }]);

    supabaseMock.queue('rpc.delete_own_exercise', { error: { message: 'EXERCISE_IN_USE' } });
    await expect(deleteCustomExercise(5, 99)).rejects.toBeInstanceOf(ExerciseInUseError);
  });
});

describe('upsertExerciseLoad', () => {
  it('saves the current load without history while typing', async () => {
    await upsertExerciseLoad({ userId: 5, exerciseId: 10, loadKg: 43.5, progressionKg: null, recordHistory: false });
    await flush();

    const [upsert] = supabaseMock.calls('exercise_loads', 'upsert');
    expect(upsert.payload).toMatchObject({ user_id: 5, exercise_id: 10, load_kg: 43.5, progression_kg: null });
    expect(upsert.options).toEqual({ onConflict: 'user_id,exercise_id' });
    expect(supabaseMock.calls('exercise_load_history')).toHaveLength(0);
  });

  it('adds the final value to the progress history (default) — never zero/empty loads', async () => {
    await upsertExerciseLoad({ userId: 5, exerciseId: 10, loadKg: 43.5, progressionKg: 45 });
    await flush();
    expect(supabaseMock.calls('exercise_load_history', 'insert')[0].payload).toMatchObject({
      user_id: 5,
      exercise_id: 10,
      load_kg: 43.5,
    });

    supabaseMock.reset();
    await upsertExerciseLoad({ userId: 5, exerciseId: 10, loadKg: null, progressionKg: null });
    await flush();
    expect(supabaseMock.calls('exercise_load_history')).toHaveLength(0);
  });
});
