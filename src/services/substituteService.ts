/**
 * "Ver substitutos": alternatives for an exercise when the machine is busy.
 *
 * 1. Curated table exercise_substitutes (ranked, prefers other equipment) —
 *    migration_exercise_substitutes.sql.
 * 2. Fallback for exercises without curated rows (e.g. the user's own) or
 *    before the migration: same primary muscle, see substitutesByMuscle.
 *
 * Either way the list never shows the same thing twice (distinctSubstitutes):
 * three lunges with the same animation read as "three identical exercises".
 */
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { Exercise } from './types';
import { listExercises } from './workoutService';
import { normalizeSearch } from '../utils/text';

export const MAX_SUBSTITUTES = 4;

const BASE_COLUMNS = `
  id, name, primary_muscle, secondary_muscle, rest_seconds, scheme, tip, exercise_library_id,
  exercise_library:exercise_library_id ( id, gif_url )
`;
// With the translations (migration_exercise_translations.sql); without them if
// the migration hasn't run yet.
const COLUMN_SETS = [`${BASE_COLUMNS}, name_i18n, tip_i18n`, BASE_COLUMNS];

const cache = new Map<number, Exercise[]>();

function toExercise(row: any): Exercise {
  return {
    id: Number(row.id),
    name: String(row.name),
    primary_muscle: row.primary_muscle ?? null,
    secondary_muscle: row.secondary_muscle ?? null,
    rest_seconds: Number(row.rest_seconds),
    scheme: String(row.scheme),
    tip: row.tip ?? null,
    name_i18n: row.name_i18n ?? null,
    tip_i18n: row.tip_i18n ?? null,
    exercise_library_id: row.exercise_library_id ?? null,
    library: row.exercise_library ?? row.library ?? null,
    owner_id: row.owner_id ?? null,
  };
}

const muscleKey = (muscle: string | null | undefined) => normalizeSearch(muscle);

const nameKey = (name: string) => muscleKey(name).replace(/\s+/g, ' ');

/**
 * Drops alternatives that would look like repeats: the exercise itself, a
 * second exercise with the same name (e.g. a user's copy of a catalogue one),
 * or a second one with the same animation (same movement under another name).
 * The first occurrence wins, so the rank order is kept.
 */
export function distinctSubstitutes(exercise: Exercise, list: Exercise[]): Exercise[] {
  const names = new Set([nameKey(exercise.name)]);
  const animations = new Set<string>();
  return list.filter((c) => {
    if (c.id === exercise.id) return false;
    const name = nameKey(c.name);
    const animation = c.library?.gif_url ?? null;
    if (names.has(name) || (animation && animations.has(animation))) return false;
    names.add(name);
    if (animation) animations.add(animation);
    return true;
  });
}

/**
 * Pure fallback: candidates whose primary muscle is the exercise's primary
 * (best) or that work it as their secondary muscle. Sharing only a secondary
 * muscle is NOT enough (a leg press is not replaced by a hip thrust). Ties
 * prefer exercises with an animation, then name.
 */
export function substitutesByMuscle(exercise: Exercise, candidates: Exercise[], limit = MAX_SUBSTITUTES): Exercise[] {
  const primary = muscleKey(exercise.primary_muscle);
  if (!primary) return [];

  const ranked = candidates
    .map((c) => {
      const cPrimary = muscleKey(c.primary_muscle);
      const cSecondary = muscleKey(c.secondary_muscle);
      let score = 0;
      if (cPrimary === primary) score = 2;
      else if (cSecondary === primary) score = 1;
      return { c, score, hasAnimation: Boolean(c.library?.gif_url) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.hasAnimation) - Number(a.hasAnimation) || a.c.name.localeCompare(b.c.name))
    .map((x) => x.c);
  return distinctSubstitutes(exercise, ranked).slice(0, limit);
}

async function curatedSubstitutes(exerciseId: number): Promise<Exercise[] | null> {
  for (const columns of COLUMN_SETS) {
    const { data, error } = await supabase
      .from('exercise_substitutes')
      .select(`rank, substitute:substitute_id ( ${columns} )`)
      .eq('exercise_id', exerciseId)
      .order('rank', { ascending: true });
    if (!error) return (data ?? []).filter((row: any) => row.substitute).map((row: any) => toExercise(row.substitute));
  }
  return null; // table missing (migration not applied): use the fallback
}

async function candidatesForFallback(userId: number): Promise<Exercise[]> {
  if (backendMode !== 'supabase') return listExercises(userId);
  for (const columns of COLUMN_SETS) {
    const { data, error } = await supabase.from('exercises').select(columns);
    if (!error) return (data ?? []).map(toExercise);
  }
  return listExercises(userId);
}

/** Up to MAX_SUBSTITUTES alternatives, best first (cached per exercise). */
export async function getExerciseSubstitutes(exercise: Exercise, userId: number): Promise<Exercise[]> {
  const cached = cache.get(exercise.id);
  if (cached) return cached;

  let result: Exercise[] | null = null;
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    result = await curatedSubstitutes(exercise.id);
  }
  if (!result || result.length === 0) {
    result = substitutesByMuscle(exercise, await candidatesForFallback(userId));
  }
  result = distinctSubstitutes(exercise, result).slice(0, MAX_SUBSTITUTES);
  cache.set(exercise.id, result);
  return result;
}

export function invalidateSubstitutesCache() {
  cache.clear();
}
