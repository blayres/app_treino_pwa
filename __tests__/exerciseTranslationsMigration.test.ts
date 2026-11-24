import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PROGRAM, normalizeExerciseName } from '../src/services/defaultWorkoutService';

// The translations migration: one row per catalogue exercise, keyed by its Portuguese name.
const sql = readFileSync(join(__dirname, '../supabase/migration_exercise_translations.sql'), 'utf8');
const rows = [...sql.matchAll(/^\s+\('((?:[^']|'')+)', '((?:[^']|'')+)'::jsonb, (null|'((?:[^']|'')+)')::jsonb\)/gm)].map((m) => ({
  name: m[1].replace(/''/g, "'"),
  names: JSON.parse(m[2].replace(/''/g, "'")),
  tips: m[4] ? JSON.parse(m[4].replace(/''/g, "'")) : null,
}));

describe('migration_exercise_translations.sql', () => {
  it('translates the 78 catalogue exercises into en, es and fr, with valid JSON', () => {
    expect(rows).toHaveLength(78);
    for (const row of rows) {
      for (const locale of ['en', 'es', 'fr']) expect(row.names[locale]?.trim()).toBeTruthy();
      if (row.tips) for (const locale of ['en', 'es', 'fr']) expect(row.tips[locale]?.trim()).toBeTruthy();
    }
    expect(rows.filter((row) => row.tips)).toHaveLength(27);
  });

  it('covers every exercise of the ready-made program', () => {
    const translated = new Set(rows.map((row) => normalizeExerciseName(row.name)));
    const missing = DEFAULT_PROGRAM.flatMap((day) => day.exercises).filter((name) => !translated.has(normalizeExerciseName(name)));
    expect(missing).toEqual([]);
  });

  it('only touches the global catalogue and can run twice', () => {
    expect(sql).toContain('where e.owner_id is null');
    expect(sql).toContain('add column if not exists name_i18n jsonb');
    expect(sql).toContain('add column if not exists tip_i18n jsonb');
  });
});
