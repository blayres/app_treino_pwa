/**
 * scripts/linkExercises.ts
 *
 * Re-runs only the linking step — matches exercises.name against exercise_library
 * and populates exercise_library_id. Safe to run multiple times.
 *
 * Use this when:
 *   - New exercises were added to the app
 *   - New aliases were added to the ALIASES map
 *   - exercise_library_id values are null despite the library being imported
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> npx ts-node --skip-project scripts/linkExercises.ts
 *
 * Add --force to re-link ALL exercises, including ones already linked:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> FORCE=1 npx ts-node --skip-project scripts/linkExercises.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const FORCE = process.env.FORCE === '1';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Normalisation ─────────────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Aliases ───────────────────────────────────────────────────────────────────

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

const SKIP_EXERCISES = new Set([
  normalize('Mackenzie dinâmico'),
  normalize('Mobilidade ombros dinâmico de joelhos e braços esticados'),
  normalize('Cardio superior'),
  normalize('Side to side Squat alternado'),
]);

// ── Link ──────────────────────────────────────────────────────────────────────

async function linkExercises(): Promise<void> {
  console.log(FORCE
    ? 'Re-linking ALL exercises (FORCE=1)...'
    : 'Linking unlinked exercises (exercise_library_id IS NULL)...\n'
  );

  // Fetch exercises — all if FORCE, otherwise only unlinked
  const query = supabase.from('exercises').select('id, name');
  if (!FORCE) query.is('exercise_library_id', null);
  const { data: exercises, error: exErr } = await query;

  if (exErr) throw exErr;
  if (!exercises || exercises.length === 0) {
    console.log('No exercises to link.');
    return;
  }

  console.log(`Found ${exercises.length} exercise(s) to process.\n`);

  // Fetch full library
  const { data: library, error: libErr } = await supabase
    .from('exercise_library')
    .select('id, name, name_pt');

  if (libErr) throw libErr;
  if (!library || library.length === 0) {
    console.error('exercise_library table is empty — run importExerciseDb.ts first.');
    process.exit(1);
  }

  console.log(`Library has ${library.length} entries.\n`);

  const libNorm = library.map((l) => ({
    ...l,
    nameNorm: normalize(l.name),
    namePtNorm: l.name_pt ? normalize(l.name_pt) : null,
  }));

  let linked = 0;
  let skipped = 0;
  const unmatched: string[] = [];
  const matchLog: Array<{ from: string; to: string; strategy: string }> = [];

  for (const ex of exercises) {
    const exNorm = normalize(ex.name);

    if (SKIP_EXERCISES.has(exNorm)) {
      console.log(`  — skipped (mobility/cardio): "${ex.name}"`);
      skipped++;
      continue;
    }

    let match: typeof libNorm[number] | undefined;
    let strategy = '';

    // 1. Exact normalized name
    match = libNorm.find((l) => l.nameNorm === exNorm);
    if (match) strategy = 'exact name';

    // 2. Exact name_pt
    if (!match) {
      match = libNorm.find((l) => l.namePtNorm === exNorm);
      if (match) strategy = 'exact name_pt';
    }

    // 3. Alias
    if (!match) {
      const aliasTarget = ALIASES[exNorm];
      if (aliasTarget) {
        match = libNorm.find((l) => l.nameNorm === aliasTarget);
        if (!match) match = libNorm.find((l) => l.nameNorm.includes(aliasTarget));
        if (match) strategy = `alias → "${aliasTarget}"`;
      }
    }

    // 4. Library name contains exercise name
    if (!match) {
      match = libNorm.find((l) => l.nameNorm.includes(exNorm));
      if (match) strategy = 'library contains exercise name';
    }

    // 5. Exercise name contains library name (min 5 chars)
    if (!match) {
      match = libNorm.find((l) => l.nameNorm.length > 5 && exNorm.includes(l.nameNorm));
      if (match) strategy = 'exercise name contains library name';
    }

    if (match) {
      const { error } = await supabase
        .from('exercises')
        .update({ exercise_library_id: match.id })
        .eq('id', ex.id);

      if (error) {
        console.error(`  ✗ DB error linking "${ex.name}": ${error.message}`);
      } else {
        linked++;
        matchLog.push({ from: ex.name, to: match.name, strategy });
      }
    } else {
      unmatched.push(ex.name);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n── Matched ──────────────────────────────────────────────────');
  for (const m of matchLog) {
    console.log(`  ✓ [${m.strategy}]`);
    console.log(`    "${m.from}" → "${m.to}"`);
  }

  console.log(`\nLinked: ${linked} | Skipped: ${skipped} | Unmatched: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('\n── Unmatched ────────────────────────────────────────────────');
    console.log('Add entries to ALIASES in this script and re-run.\n');
    for (const name of unmatched) {
      console.log(`  ✗ "${name}"  →  normalized: "${normalize(name)}"`);
    }
  } else {
    console.log('\nAll exercises linked!');
  }
}

linkExercises().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
