/**
 * "Ver substitutos": alternatives for an exercise when the machine is busy.
 *
 * 1. Curated table exercise_substitutes (ranked, prefers other equipment) —
 *    migration_exercise_substitutes.sql.
 * 2. Fallback for exercises without curated rows (e.g. the user's own) or
 *    before the migration: same primary muscle, see substitutesByMuscle.
 */
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import type { Exercise } from './types';
import { listExercises } from './workoutService';

export const MAX_SUBSTITUTES = 4;

const EXERCISE_COLUMNS = `
  id, name, primary_muscle, secondary_muscle, rest_seconds, scheme, tip, exercise_library_id,
  exercise_library:exercise_library_id ( id, gif_url )
`;

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
    exercise_library_id: row.exercise_library_id ?? null,
    library: row.exercise_library ?? row.library ?? null,
    owner_id: row.owner_id ?? null,
  };
}

const muscleKey = (muscle: string | null | undefined) =>
  (muscle ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const nameKey = (name: string) => muscleKey(name).replace(/\s+/g, ' ');

/**
 * Pure fallback: candidates whose primary muscle is the exercise's primary
 * (best) or that work it as their secondary muscle. Sharing only a secondary
 * muscle is NOT enough (a leg press is not replaced by a hip thrust). Ties
 * prefer exercises with an animation, then name.
 */
export function substitutesByMuscle(exercise: Exercise, candidates: Exercise[], limit = MAX_SUBSTITUTES): Exercise[] {
  const primary = muscleKey(exercise.primary_muscle);
  if (!primary) return [];
  const self = nameKey(exercise.name);

  return candidates
    .filter((c) => c.id !== exercise.id && nameKey(c.name) !== self)
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
    .slice(0, limit)
    .map((x) => x.c);
}

async function curatedSubstitutes(exerciseId: number): Promise<Exercise[] | null> {
  const { data, error } = await supabase
    .from('exercise_substitutes')
    .select(`rank, substitute:substitute_id ( ${EXERCISE_COLUMNS} )`)
    .eq('exercise_id', exerciseId)
    .order('rank', { ascending: true });
  if (error) return null; // table missing (migration not applied): use the fallback
  return (data ?? []).filter((row: any) => row.substitute).map((row: any) => toExercise(row.substitute));
}

async function candidatesForFallback(userId: number): Promise<Exercise[]> {
  if (backendMode !== 'supabase') return listExercises(userId);
  const { data, error } = await supabase.from('exercises').select(EXERCISE_COLUMNS);
  if (error) return listExercises(userId);
  return (data ?? []).map(toExercise);
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
  result = result.slice(0, MAX_SUBSTITUTES);
  cache.set(exercise.id, result);
  return result;
}

export function invalidateSubstitutesCache() {
  cache.clear();
}
