import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const calls: string[] = [];
let nextId = 100;

jest.mock('../src/services/workoutService', () => ({
  DEFAULT_CUSTOM_SCHEME: '3x10-12',
  DEFAULT_CUSTOM_REST_SECONDS: 60,
  archiveWorkout: jest.fn(async (id: number) => {
    calls.push(`archive:${id}`);
  }),
  updateWorkoutTitle: jest.fn(async (id: number, title: string) => {
    calls.push(`title:${id}:${title}`);
  }),
  replaceWorkoutItems: jest.fn(async (id: number, items: any[]) => {
    calls.push(`items:${id}:${items.map((i) => `${i.exerciseId}/${i.scheme ?? '-'}`).join(',')}`);
  }),
  createWorkoutForUser: jest.fn(async (p: any) => {
    calls.push(`create:${p.dayOfWeek}:${p.title}:${p.items.map((i: any) => `${i.exerciseId}/${i.scheme ?? '-'}`).join(',')}`);
    return nextId++;
  }),
  createCustomExercise: jest.fn(async (p: any) => {
    calls.push(`newExercise:${p.name}`);
    return { id: 900, name: p.name, scheme: p.scheme, rest_seconds: p.restSeconds };
  }),
  invalidateWorkoutsByUserCache: jest.fn(),
  invalidateWorkoutExercisesCache: jest.fn(),
  getWorkoutsByUser: jest.fn(),
  getWorkoutExercises: jest.fn(),
}));

import { isProgramDirty, saveProgram, type DraftDay } from '../src/services/programService';

const ex = (id: number, scheme = '4x10') =>
  ({ id, name: `Ex${id}`, scheme, rest_seconds: 60, primary_muscle: null, secondary_muscle: null, tip: null, exercise_library_id: null }) as any;

const item = (id: number, scheme = '4x10') => ({
  key: `i${id}`,
  exercise: ex(id),
  name: `Ex${id}`,
  scheme,
  restSeconds: null,
  wrote: null,
});

const day = (workoutId: number | undefined, dayOfWeek: number, title: string, items: any[]): DraftDay => ({
  key: `d${workoutId ?? 'new'}${dayOfWeek}`,
  workoutId,
  dayOfWeek,
  title,
  items,
});

const original = [day(1, 1, 'A', [item(10), item(11)]), day(2, 3, 'B', [item(20)])];
const defaultTitle = (d: number) => `Dia ${d}`;

beforeEach(() => {
  calls.length = 0;
  nextId = 100;
});

describe('saveProgram', () => {
  it('does nothing when nothing changed', async () => {
    await saveProgram({ userId: 1, draft: original, original, defaultTitle });
    expect(calls).toEqual([]);
  });

  it('updates only the title and exercises that changed', async () => {
    const draft = [day(1, 1, 'A2', [item(10), item(11)]), day(2, 3, 'B', [item(20, '5x5'), item(21)])];
    await saveProgram({ userId: 1, draft, original, defaultTitle });
    expect(calls).toEqual(['title:1:A2', 'items:2:20/5x5,21/-']);
  });

  it('archives removed (hidden) days and creates new ones with a default title', async () => {
    const draft = [{ ...original[0], hidden: true }, original[1], day(undefined, 5, '', [item(30)])];
    await saveProgram({ userId: 1, draft, original, defaultTitle });
    expect(calls).toEqual(['archive:1', 'create:5:Dia 5:30/-']);
  });

  it('moves a day by archiving and re-creating it, archiving before creating (swap-safe)', async () => {
    const draft = [{ ...original[0], dayOfWeek: 3 }, { ...original[1], dayOfWeek: 1 }];
    await saveProgram({ userId: 1, draft, original, defaultTitle });
    expect(calls).toEqual(['archive:1', 'archive:2', 'create:3:A:10/-,11/-', 'create:1:B:20/-']);
  });

  it('replaceAll archives everything and creates new exercises once', async () => {
    const newItem = { key: 'n', exercise: null, name: 'Remada cavalinho', scheme: '3x12', restSeconds: null, wrote: null };
    const draft = [day(undefined, 2, 'X', [newItem]), day(undefined, 4, 'Y', [{ ...newItem, key: 'n2' }])];
    await saveProgram({ userId: 1, draft, original, replaceAll: true, defaultTitle });
    expect(calls).toEqual([
      'newExercise:Remada cavalinho',
      'archive:1',
      'archive:2',
      'create:2:X:900/-',
      'create:4:Y:900/-',
    ]);
  });

  it('skips days already created by a failed earlier attempt', async () => {
    const draft = [day(undefined, 2, 'X', [item(10)]), day(undefined, 4, 'Y', [item(11)])];
    await saveProgram({ userId: 1, draft, original: [], defaultTitle, createdDays: new Set([2]) });
    expect(calls).toEqual(['create:4:Y:11/-']);
  });
});

describe('isProgramDirty', () => {
  it('detects edits and ignores no-ops', () => {
    expect(isProgramDirty(original, original.map((d) => ({ ...d })))).toBe(false);
    expect(isProgramDirty(original, [{ ...original[0], title: 'Novo' }, original[1]])).toBe(true);
    expect(isProgramDirty(original, [{ ...original[0], hidden: true }, original[1]])).toBe(true);
    expect(isProgramDirty(original, [original[0], { ...original[1], items: [item(20, '3x8')] }])).toBe(true);
  });
});
