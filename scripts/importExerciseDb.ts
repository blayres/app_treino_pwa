/**
 * scripts/importExerciseDb.ts
 *
 * Imports exercises from the free, public-domain yuhonas/free-exercise-db
 * dataset into the exercise_library table in Supabase, then auto-links
 * exercises.exercise_library_id by name matching.
 *
 * Source: https://github.com/yuhonas/free-exercise-db
 * License: Public Domain — no API key required.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx ts-node scripts/importExerciseDb.ts
 *
 * Required env vars:
 *   SUPABASE_SERVICE_ROLE_KEY  — Supabase service role key (server-side only)
 *   EXPO_PUBLIC_SUPABASE_URL   — Supabase project URL (already in .env)
 *
 * The SERVICE_ROLE_KEY is only used here in this server-side script.
 * It is never imported or referenced anywhere in the app source.
 */

import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Base URL for exercise images hosted on GitHub raw content
const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

// JSON dataset URL — single combined file, no auth required
const DATASET_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

// ── Dataset types ─────────────────────────────────────────────────────────────

type FreeExerciseItem = {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[]; // relative paths, e.g. "Bench_Press/0.jpg"
};

// ── String normalisation ──────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── PT-BR → English alias map ─────────────────────────────────────────────────
//
// Keys: normalized PT-BR exercise names (output of normalize())
// Values: normalized English name or keyword to match against the library
//
// Add entries here whenever the script reports unmatched exercises.

const ALIASES: Record<string, string> = {
  // ── Chest ──────────────────────────────────────────────────────────────────
  'supino':                                              'barbell bench press',
  'supino na maquina':                                   'machine chest press',
  'supino reto maquina deitado':                         'machine chest press',
  'supino inclinado':                                    'incline bench press',
  'supino declinado':                                    'decline bench press',
  'supino com halteres':                                 'dumbbell bench press',
  'crucifixo':                                           'dumbbell fly',
  'fly':                                                 'cable fly',

  // ── Back ───────────────────────────────────────────────────────────────────
  'remada':                                              'seated cable row',
  'remada na maquina':                                   'seated cable row',
  'remada curvada':                                      'barbell bent over row',
  'remada curvada carga leve':                           'bent over row',
  'remada curvada pronada barra livre':                  'barbell bent over row',
  'remada unilateral':                                   'dumbbell bent over row',
  'puxada alta':                                         'lat pulldown',
  'puxada alta na maquina':                              'lat pulldown',
  'puxada frente':                                       'lat pulldown',
  'pull down barra reta polia alta':                     'straight arm pulldown',
  'graviton':                                            'assisted pull up',
  'barra fixa':                                          'pull-up',
  'pulldown':                                            'lat pulldown',

  // ── Shoulders ──────────────────────────────────────────────────────────────
  'desenvolvimento':                                     'overhead press',
  'desenvolvimento na maquina':                          'machine shoulder press',
  'desenvolvimento de ombros maquina sentado':           'seated machine shoulder press',
  'desenvolvimento no banco':                            'dumbbell shoulder press',
  'elevacao lateral':                                    'lateral raise',
  'elevacao frontal':                                    'dumbbell front raise',
  'fly inverso':                                         'reverse fly',
  'crucifixo inverso':                                   'reverse fly',

  // ── Arms ───────────────────────────────────────────────────────────────────
  'rosca biceps':                                        'barbell curl',
  'rosca biceps na polia':                               'cable curl',
  'biceps rosca direta polia baixa':                     'cable curl',
  'biceps rosca martelo com halter':                     'hammer curl',
  'rosca direta':                                        'barbell curl',
  'rosca alternada':                                     'dumbbell alternate bicep curl',
  'rosca martelo':                                       'hammer curl',
  'triceps na polia':                                    'cable tricep pushdown',
  'triceps corda':                                       'cable pushdown',
  'triceps testa':                                       'lying tricep extension',
  'triceps frances':                                     'ez barbell skull crusher',
  'biceps triceps maquina':                              'cable curl',
  'biceps triceps combinado':                            'cable curl',

  // ── Legs ───────────────────────────────────────────────────────────────────
  'agachamento':                                         'barbell squat',
  'agachamento livre barra':                             'barbell squat',
  'agachamento barra guiada smith':                      'smith machine squat',
  'agachamento na maquina':                              'smith machine squat',
  'agachamento sumo':                                    'sumo squat',
  'agachamento hack':                                    'hack squat',
  'leg press':                                           'leg press',
  'leg press 45':                                        'leg press',
  'cadeira extensora':                                   'leg extension',
  'cadeira flexora':                                     'seated leg curl',
  'mesa flexora':                                        'lying leg curl',
  'stiff':                                               'romanian deadlift',
  'stiff barra livre':                                   'romanian deadlift',
  'levantamento terra':                                  'deadlift',
  'afundo':                                              'dumbbell lunge',
  'afundo com halteres step':                            'dumbbell lunge',
  'bulgaro':                                             'bulgarian split squat',
  'abdutora':                                            'hip abduction',
  'abdutora 45':                                         'hip abduction',
  'adutora':                                             'hip adduction',
  'panturrilha no leg press':                            'calf press on leg press',
  'panturrilha em pe':                                   'standing calf raise',
  'panturrilha sentado':                                 'seated calf raise',

  // ── Core ───────────────────────────────────────────────────────────────────
  'prancha':                                             'plank',
  'abdominal':                                           'crunch',
  'abdominal crunch':                                    'crunch',
  'crunch':                                              'crunch',
  'elevacao de pernas':                                  'leg raise',
  'elevacao de pernas deitado':                          'lying leg raise',
  'abdominal remador':                                   'bicycle crunch',
  'obliquo':                                             'oblique crunch',
  'lombar':                                              'back extension',
  'hiperextensao':                                       'back extension',
  'abdominal infra':                                     'leg raise',

  // ── Glutes ─────────────────────────────────────────────────────────────────
  'gluteo':                                              'glute bridge',
  'ponte gluteo':                                        'glute bridge',
  'elevacao quadril':                                    'glute bridge',
  'elevacao pelvica chao':                               'glute bridge',
  'elevacao pelvica maquina':                            'hip thrust',
  'gluteo na polia perna esticada':                      'cable glute kickback',
  'kickback':                                            'cable glute kickback',
  'coice':                                               'cable glute kickback',

  // ── Cardio ─────────────────────────────────────────────────────────────────
  'corrida':                                             'run',
};

// ── Exercises to skip (mobility / custom / cardio with no library match) ──────
//
// These are intentionally excluded from linking — no library entry exists
// and none is needed. They will not appear in the unmatched list.

const SKIP_EXERCISES = new Set([
  normalize('Mackenzie dinâmico'),
  normalize('Mobilidade ombros dinâmico de joelhos e braços esticados'),
  normalize('Cardio superior'),
  normalize('Side to side Squat alternado'),
]);

// ── Fetch dataset ─────────────────────────────────────────────────────────────

async function fetchDataset(): Promise<FreeExerciseItem[]> {
  console.log('Fetching free-exercise-db dataset (no API key required)...');
  console.log(`Source: ${DATASET_URL}\n`);

  const res = await fetch(DATASET_URL);

  if (!res.ok) {
    throw new Error(`Dataset fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as FreeExerciseItem[];
  console.log(`Fetched ${data.length} exercises.`);
  return data;
}

// ── Upsert into exercise_library ─────────────────────────────────────────────

async function upsertLibrary(exercises: FreeExerciseItem[]): Promise<void> {
  const BATCH = 100;
  let upserted = 0;

  for (let i = 0; i < exercises.length; i += BATCH) {
    const batch = exercises.slice(i, i + BATCH).map((ex) => {
      // Build absolute image URL from the first available image.
      // Images are static JPGs hosted on GitHub — no GIFs in this dataset,
      // but they load fast and work on all platforms.
      const gif_url = ex.images.length > 0
        ? `${IMAGE_BASE}/${ex.images[0]}`
        : null;

      return {
        external_id: ex.id,
        source: 'free-exercise-db',
        name: ex.name,
        name_pt: null,
        // Map dataset fields to exercise_library schema
        body_part: ex.category ?? null,
        target_muscle: ex.primaryMuscles[0] ?? null,
        secondary_muscles: ex.secondaryMuscles,
        equipment: ex.equipment ?? null,
        gif_url,
        instructions: ex.instructions,
      };
    });

    const { error } = await supabase
      .from('exercise_library')
      .upsert(batch, { onConflict: 'external_id' });

    if (error) {
      console.error(`Upsert error at batch ${i}:`, error.message);
      throw error;
    }

    upserted += batch.length;
    process.stdout.write(`\rUpserted ${upserted}/${exercises.length}...`);
  }

  console.log(`\nDone upserting ${upserted} library entries.`);
}

// ── Auto-link exercises → exercise_library ────────────────────────────────────
//
// Matching strategy (in order of priority):
//   1. Exact normalized match on library.name
//   2. Exact normalized match on library.name_pt
//   3. Alias lookup: normalize(exercise.name) → alias → find in library
//   4. Partial contains: library.name contains the normalized exercise name
//   5. Partial contains: normalized exercise name contains a library name word
//
// Only updates rows where exercise_library_id IS NULL to avoid overwriting
// manual links set via the admin panel.

async function linkExercises(): Promise<void> {
  console.log('\nLinking exercises to library...');

  const { data: exercises, error: exErr } = await supabase
    .from('exercises')
    .select('id, name')
    .is('exercise_library_id', null);

  if (exErr) throw exErr;
  if (!exercises || exercises.length === 0) {
    console.log('No unlinked exercises found.');
    return;
  }

  const { data: library, error: libErr } = await supabase
    .from('exercise_library')
    .select('id, name, name_pt');

  if (libErr) throw libErr;
  if (!library) return;

  // Pre-compute normalized names once
  const libNorm = library.map((l) => ({
    ...l,
    nameNorm: normalize(l.name),
    namePtNorm: l.name_pt ? normalize(l.name_pt) : null,
  }));

  let linked = 0;
  const unmatched: string[] = [];
  const matchLog: Array<{ from: string; to: string; strategy: string }> = [];

  for (const ex of exercises) {
    const exNorm = normalize(ex.name);

    // Skip mobility/cardio/custom exercises that have no library equivalent
    if (SKIP_EXERCISES.has(exNorm)) {
      console.log(`  — skipped (mobility/cardio): "${ex.name}"`);
      continue;
    }

    let match: typeof libNorm[number] | undefined;
    let strategy = '';

    // 1. Exact normalized match on library.name
    match = libNorm.find((l) => l.nameNorm === exNorm);
    if (match) strategy = 'exact name';

    // 2. Exact normalized match on library.name_pt
    if (!match) {
      match = libNorm.find((l) => l.namePtNorm === exNorm);
      if (match) strategy = 'exact name_pt';
    }

    // 3. Alias lookup
    if (!match) {
      const aliasTarget = ALIASES[exNorm];
      if (aliasTarget) {
        match = libNorm.find((l) => l.nameNorm === aliasTarget);
        if (!match) {
          match = libNorm.find((l) => l.nameNorm.includes(aliasTarget));
        }
        if (match) strategy = `alias → "${aliasTarget}"`;
      }
    }

    // 4. Library name contains the full exercise name
    if (!match) {
      match = libNorm.find((l) => l.nameNorm.includes(exNorm));
      if (match) strategy = 'library contains exercise name';
    }

    // 5. Exercise name contains a significant library name (min 5 chars)
    if (!match) {
      match = libNorm.find(
        (l) => l.nameNorm.length > 5 && exNorm.includes(l.nameNorm),
      );
      if (match) strategy = 'exercise name contains library name';
    }

    if (match) {
      const { error } = await supabase
        .from('exercises')
        .update({ exercise_library_id: match.id })
        .eq('id', ex.id);

      if (error) {
        console.error(`  ✗ Failed to link "${ex.name}": ${error.message}`);
      } else {
        linked++;
        matchLog.push({ from: ex.name, to: match.name, strategy });
      }
    } else {
      unmatched.push(ex.name);
    }
  }

  // ── Results ────────────────────────────────────────────────────────────────

  console.log('\n── Matched ──────────────────────────────────────────────────');
  for (const m of matchLog) {
    console.log(`  ✓ [${m.strategy}]`);
    console.log(`    "${m.from}" → "${m.to}"`);
  }

  console.log(`\nLinked: ${linked}/${exercises.length}`);

  if (unmatched.length > 0) {
    console.log('\n── Unmatched ────────────────────────────────────────────────');
    console.log('These exercises have no library match. Options:');
    console.log('  a) Add an entry to the ALIASES map in this script and re-run');
    console.log('  b) Set name_pt in exercise_library manually in Supabase');
    console.log('  c) Link manually via the admin panel\n');
    for (const name of unmatched) {
      console.log(`  ✗ "${name}"  (normalized: "${normalize(name)}")`);
    }
  } else {
    console.log('\nAll exercises linked successfully!');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const exercises = await fetchDataset();
    await upsertLibrary(exercises);
    await linkExercises();
    console.log('\nImport complete.');
  } catch (err) {
    console.error('\nImport failed:', err);
    process.exit(1);
  }
}

main();
