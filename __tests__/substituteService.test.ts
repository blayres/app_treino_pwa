import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  getExerciseSubstitutes,
  invalidateSubstitutesCache,
  substitutesByMuscle,
} from '../src/services/substituteService';

const ex = (id: number, name: string, primary: string | null, secondary: string | null = null, gif = false) =>
  ({
    id,
    name,
    primary_muscle: primary,
    secondary_muscle: secondary,
    rest_seconds: 60,
    scheme: '3x10',
    tip: null,
    exercise_library_id: gif ? `lib${id}` : null,
    library: gif ? { id: `lib${id}`, gif_url: `https://x/${id}.gif` } : null,
  }) as any;

const supinoMaquina = ex(1, 'Supino na Máquina', 'peito', 'triceps');

describe('substitutesByMuscle', () => {
  const candidates = [
    supinoMaquina,
    ex(2, 'Flexão de braço', 'peito', 'triceps'),
    ex(3, 'Supino reto com halteres', 'Peito', 'triceps', true), // case/accents ignored
    ex(4, 'Tríceps na Polia', 'triceps'),
    ex(5, 'Mergulho', 'tríceps', 'peito'),
    ex(6, 'Agachamento', 'quadriceps'),
    ex(7, 'Sem músculo', null),
  ];

  it('same primary muscle first (animated first), then those working it as secondary; never itself', () => {
    const result = substitutesByMuscle(supinoMaquina, candidates);
    // 4 (triceps only — the exercise's *secondary*) is not a substitute.
    expect(result.map((e) => e.id)).toEqual([3, 2, 5]);
  });

  it('respects the limit and returns nothing for an exercise without a muscle', () => {
    expect(substitutesByMuscle(supinoMaquina, candidates, 2).map((e) => e.id)).toEqual([3, 2]);
    expect(substitutesByMuscle(ex(9, 'Livre', null), candidates)).toEqual([]);
  });
});

describe('getExerciseSubstitutes', () => {
  beforeEach(() => {
    supabaseMock.reset();
    invalidateSubstitutesCache();
  });

  it('uses the curated table in rank order (with animations) and caches it', async () => {
    supabaseMock.queue('exercise_substitutes.select', {
      data: [
        { rank: 1, substitute: { ...ex(3, 'Supino reto com halteres', 'peito'), exercise_library: { id: 'l3', gif_url: 'g' } } },
        { rank: 2, substitute: ex(2, 'Flexão de braço', 'peito') },
      ],
    });

    const result = await getExerciseSubstitutes(supinoMaquina, 5);
    await getExerciseSubstitutes(supinoMaquina, 5);

    expect(result.map((e) => e.name)).toEqual(['Supino reto com halteres', 'Flexão de braço']);
    expect(result[0].library).toEqual({ id: 'l3', gif_url: 'g' });
    const [query] = supabaseMock.calls('exercise_substitutes', 'select');
    expect(filter(query, 'eq', 'exercise_id')).toEqual(['eq', 'exercise_id', 1]);
    expect(supabaseMock.calls('exercise_substitutes')).toHaveLength(1);
  });

  it('falls back to the same muscle when nothing is curated (e.g. a custom exercise)', async () => {
    supabaseMock.queue('exercise_substitutes.select', { data: [] });
    supabaseMock.queue('exercises.select', { data: [ex(2, 'Flexão de braço', 'peito'), ex(6, 'Agachamento', 'quadriceps')] });

    const result = await getExerciseSubstitutes(supinoMaquina, 5);
    expect(result.map((e) => e.id)).toEqual([2]);
  });

  it('falls back too when the table does not exist yet', async () => {
    supabaseMock.queue('exercise_substitutes.select', { error: { code: 'PGRST205' } });
    supabaseMock.queue('exercises.select', { data: [ex(2, 'Flexão de braço', 'peito')] });
    expect((await getExerciseSubstitutes(supinoMaquina, 5)).map((e) => e.id)).toEqual([2]);
  });
});
