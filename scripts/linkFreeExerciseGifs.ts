/**
 * scripts/linkFreeExerciseGifs.ts
 *
 * Points exercise_library.gif_url at the animated GIFs of the free ExerciseDB V1
 * (https://exercisedb.dev, 1,500 exercises), replacing the free-exercise-db photo.
 * The GIFs are shown straight from static.exercisedb.dev: nothing is copied to
 * Supabase Storage.
 *
 * The pairs live in scripts/data/exercisedb-v1-gifs.json (library id → GIF). They
 * were built by matching names (same words, same equipment, no opposite variants
 * such as palms up/down or incline/decline) plus a hand-checked alias list, and
 * every GIF URL answered 200 when the file was generated.
 *
 * Only rows still on the photo (source = 'free-exercise-db') are touched, so the
 * RapidAPI GIFs already in Storage are kept. Safe to run more than once.
 *
 * Usage:
 *   DRY_RUN=1 node --env-file=.env scripts/linkFreeExerciseGifs.ts
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node --env-file=.env scripts/linkFreeExerciseGifs.ts
 *
 * Undo (puts the free-exercise-db photo back on every row this script changed):
 *   REVERT=1 SUPABASE_SERVICE_ROLE_KEY=<key> node --env-file=.env scripts/linkFreeExerciseGifs.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const DRY_RUN = process.env.DRY_RUN === '1';
const REVERT = process.env.REVERT === '1';

const PHOTO_SOURCE = 'free-exercise-db';
const GIF_SOURCE = 'free-exercise-db+exercisedb-v1-gif';
const PHOTO_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

if (!SUPABASE_URL || (!SERVICE_ROLE_KEY && !(DRY_RUN && ANON_KEY))) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (DRY_RUN=1 also works with the anon key)');
  process.exit(1);
}

// The anon key can read the library but not write it: every update would fail
// with "permission denied for table exercise_library".
if (!DRY_RUN && SERVICE_ROLE_KEY === ANON_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is the anon key. Use the service_role (or sb_secret_…) key, or run supabase/migration_exercise_gifs_v1.sql in the SQL Editor.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || ANON_KEY, {
  auth: { persistSession: false },
});

type GifPair = { library_id: string; name: string; exercisedb_name: string; gif_url: string };

const pairs: GifPair[] = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts/data/exercisedb-v1-gifs.json'), 'utf8')
);

async function revert() {
  const { data, error } = await supabase
    .from('exercise_library')
    .select('id, name, external_id')
    .eq('source', GIF_SOURCE);
  if (error) throw error;

  console.log(`${data.length} rows to put back on the photo.`);
  if (DRY_RUN) return;

  for (const row of data) {
    const { error: updateErr } = await supabase
      .from('exercise_library')
      .update({ gif_url: `${PHOTO_BASE}/${row.external_id}/0.jpg`, source: PHOTO_SOURCE })
      .eq('id', row.id)
      .eq('source', GIF_SOURCE);
    if (updateErr) console.error(`✗ ${row.name}: ${updateErr.message}`);
  }
  console.log('Done.');
}

async function link() {
  // Batched: 420 ids in one .in() filter overflow the URL length limit.
  const data: { id: string; source: string | null }[] = [];
  for (let i = 0; i < pairs.length; i += 100) {
    const { data: batch, error } = await supabase
      .from('exercise_library')
      .select('id, source')
      .in('id', pairs.slice(i, i + 100).map((p) => p.library_id));
    if (error) throw error;
    data.push(...batch);
  }

  const sourceById = new Map(data.map((row) => [row.id, row.source]));
  const todo = pairs.filter((p) => sourceById.get(p.library_id) === PHOTO_SOURCE);
  const done = pairs.filter((p) => sourceById.get(p.library_id) === GIF_SOURCE).length;
  const missing = pairs.filter((p) => !sourceById.has(p.library_id)).length;

  console.log(`${pairs.length} pairs: ${todo.length} to update, ${done} already done, ${missing} not found.`);
  if (DRY_RUN) {
    todo.slice(0, 10).forEach((p) => console.log(`  ${p.name} → ${p.exercisedb_name}`));
    return;
  }

  let updated = 0;
  for (const p of todo) {
    const { error: updateErr } = await supabase
      .from('exercise_library')
      .update({ gif_url: p.gif_url, source: GIF_SOURCE })
      .eq('id', p.library_id)
      .eq('source', PHOTO_SOURCE);
    if (updateErr) console.error(`✗ ${p.name}: ${updateErr.message}`);
    else updated++;
  }
  console.log(`Done. Updated: ${updated}.`);
}

(REVERT ? revert() : link()).catch((err) => {
  console.error(err);
  process.exit(1);
});
