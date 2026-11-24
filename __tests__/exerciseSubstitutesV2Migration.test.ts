import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(join(__dirname, '../supabase/migration_exercise_substitutes_v2.sql'), 'utf8');
const pairs = [...sql.matchAll(/\('([^']+)', '([^']+)', (\d)\)/g)].map(([, exercise, substitute, rank]) => ({
  exercise,
  substitute,
  rank: Number(rank),
}));
const listOf = (exercise: string) =>
  pairs.filter((p) => p.exercise === exercise).sort((a, b) => a.rank - b.rank).map((p) => p.substitute);
const exercises = [...new Set(pairs.map((p) => p.exercise))];

// Same exercise under two names in the catalogue (same animation, same equipment).
const SAME_EXERCISE = [
  ['Afundo', 'Afundo com halteres (step)', 'Passada com halteres'],
  ['Stiff', 'Stiff barra livre'],
  ['Lombar', 'Hiperextensão no banco'],
  ['Rosca Bíceps na Polia', 'Bíceps Rosca direta polia baixa'],
  ['Desenvolvimento na Máquina', 'Desenvolvimento de ombros máquina sentado'],
  ['Desenvolvimento no Banco', 'Desenvolvimento com halteres'],
  ['Supino na Máquina', 'Supino Reto máquina deitado'],
  ['Leg Press 45°', 'Leg Press 45° Perna Aberta'],
  ['Agachamento na Máquina', 'Agachamento barra guiada Smith'],
  ['Remada na Máquina', 'Remada baixa na polia'],
];

describe('migration_exercise_substitutes_v2.sql', () => {
  it('"Afundo" no longer lists other lunges', () => {
    expect(listOf('Afundo')).toEqual(['Búlgaro', 'Agachamento goblet', 'Leg Press 45°', 'Agachamento barra guiada Smith']);
  });

  it('never pairs an exercise with itself renamed, nor lists two of the same group', () => {
    for (const group of SAME_EXERCISE) {
      for (const exercise of exercises) {
        const list = listOf(exercise);
        const inGroup = list.filter((name) => group.includes(name));
        expect({ exercise, inGroup: inGroup.length <= 1 }).toEqual({ exercise, inGroup: true });
        if (group.includes(exercise)) {
          expect({ exercise, renamed: list.filter((name) => group.includes(name)) }).toEqual({ exercise, renamed: [] });
        }
      }
    }
  });

  it('2–4 options per exercise, ranks 1..n, no self pair', () => {
    for (const exercise of exercises) {
      const ranks = pairs.filter((p) => p.exercise === exercise).map((p) => p.rank).sort();
      expect({ exercise, ranks }).toEqual({ exercise, ranks: ranks.map((_, i) => i + 1) });
      expect(ranks.length).toBeGreaterThanOrEqual(2);
      expect(ranks.length).toBeLessThanOrEqual(4);
      expect(listOf(exercise)).not.toContain(exercise);
    }
  });

  it('only touches the catalogue and replaces the old lists before inserting', () => {
    expect(sql.match(/owner_id is null/g)).toHaveLength(2);
    expect(sql.indexOf('delete from public.exercise_substitutes')).toBeLessThan(sql.indexOf('insert into public.exercise_substitutes'));
    expect(sql).toMatch(/on conflict \(exercise_id, substitute_id\) do update/);
  });
});
