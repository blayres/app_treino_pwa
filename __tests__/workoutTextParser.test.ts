import { describe, expect, it } from '@jest/globals';
import {
  assignWeekdays,
  matchExercise,
  parseWorkoutText,
} from '../src/services/workoutTextParser';

describe('parseWorkoutText', () => {
  it('reads weekday headers, bullets, numbering, schemes and rest', () => {
    const days = parseWorkoutText(`
Segunda - Treino A (Costas e Bíceps)
1. Puxada alta 4x10-12
- Remada curvada 3 x 12 descanso 60s
• Rosca direta 3 séries de 10

Quarta-feira: Pernas
Agachamento livre 4X8 a 10 90"
Cadeira extensora 3x15 1'30
`);

    expect(days).toHaveLength(2);
    expect(days[0]).toEqual({
      dayOfWeek: 1,
      title: 'Treino A (Costas e Bíceps)',
      exercises: [
        { name: 'Puxada alta', scheme: '4x10-12', restSeconds: null },
        { name: 'Remada curvada', scheme: '3x12', restSeconds: 60 },
        { name: 'Rosca direta', scheme: '3x10', restSeconds: null },
      ],
    });
    expect(days[1].dayOfWeek).toBe(3);
    expect(days[1].title).toBe('Pernas');
    expect(days[1].exercises).toEqual([
      { name: 'Agachamento livre', scheme: '4x8-10', restSeconds: 90 },
      { name: 'Cadeira extensora', scheme: '3x15', restSeconds: 90 },
    ]);
  });

  it('accepts label headers without weekdays and abbreviated weekdays', () => {
    const days = parseWorkoutText(`Treino A
Supino reto 4x10
Treino B:
Leg press 4x12
SEX.
Elevação lateral 3x15`);
    expect(days.map((d) => [d.dayOfWeek, d.title])).toEqual([
      [null, 'Treino A'],
      [null, 'Treino B'],
      [5, ''],
    ]);
  });

  it('puts exercises without any header into one day', () => {
    const days = parseWorkoutText('Supino 4x10\nCrucifixo 3x12');
    expect(days).toHaveLength(1);
    expect(days[0].dayOfWeek).toBeNull();
    expect(days[0].exercises.map((e) => e.name)).toEqual(['Supino', 'Crucifixo']);
  });

  it('keeps exercises that have no scheme and ignores empty headers', () => {
    const days = parseWorkoutText('Dia 1\nPrancha\nDia 2\n\nDia 3\nBurpee 3x20');
    expect(days.map((d) => d.title)).toEqual(['Dia 1', 'Dia 3']);
    expect(days[0].exercises[0]).toEqual({ name: 'Prancha', scheme: null, restSeconds: null });
  });

  it('does not read cardio minutes as rest', () => {
    const [day] = parseWorkoutText('Esteira 10 min');
    expect(day.exercises[0].restSeconds).toBeNull();
  });

  it('only treats rest keywords as whole words', () => {
    const [day] = parseWorkoutText('Forest lunge 3x10 20');
    expect(day.exercises[0]).toEqual({ name: 'Forest lunge 20', scheme: '3x10', restSeconds: null });
  });

  it('reads English input', () => {
    const [day] = parseWorkoutText('Monday\nBench press 4 sets of 8-10 rest 2min');
    expect(day.dayOfWeek).toBe(1);
    expect(day.exercises[0]).toEqual({ name: 'Bench press', scheme: '4x8-10', restSeconds: 120 });
  });
});

describe('assignWeekdays', () => {
  it('fills missing weekdays with the next free day and titles untitled days', () => {
    const days = assignWeekdays(
      [
        { dayOfWeek: null, title: 'A', exercises: [] },
        { dayOfWeek: 1, title: 'B', exercises: [] },
        { dayOfWeek: null, title: '', exercises: [] },
      ],
      (i) => `Treino ${i + 1}`,
    );
    expect(days.map((d) => [d.dayOfWeek, d.title])).toEqual([
      [2, 'A'],
      [1, 'B'],
      [3, 'Treino 3'],
    ]);
  });

  it('moves duplicate weekdays to free days', () => {
    const days = assignWeekdays(
      [
        { dayOfWeek: 1, title: 'A', exercises: [] },
        { dayOfWeek: 1, title: 'B', exercises: [] },
      ],
      () => '',
    );
    expect(days.map((d) => d.dayOfWeek)).toEqual([1, 2]);
  });
});

describe('matchExercise', () => {
  const catalogue = [
    { name: 'Puxada Alta na Máquina' },
    { name: 'Leg Press 45°' },
    { name: 'Rosca Bíceps na Polia' },
    { name: 'Supino na Máquina' },
  ];

  it('matches exactly ignoring case, accents, small words and order', () => {
    expect(matchExercise('puxada alta maquina', catalogue)).toEqual({ item: catalogue[0], exact: true });
    expect(matchExercise('LEG PRESS 45°', catalogue)).toEqual({ item: catalogue[1], exact: true });
  });

  it('suggests a similar exercise when the words mostly overlap', () => {
    expect(matchExercise('Puxada alta', catalogue)).toEqual({ item: catalogue[0], exact: false });
    expect(matchExercise('Rosca biceps polia', catalogue)?.item).toBe(catalogue[2]);
  });

  it('returns null when nothing is close', () => {
    expect(matchExercise('Agachamento búlgaro', catalogue)).toBeNull();
    expect(matchExercise('', catalogue)).toBeNull();
  });
});

describe('coach sheets (real examples)', () => {
   
  const { readFileSync } = require('fs');
  const fixture = (name: string) => readFileSync(`${__dirname}/fixtures/${name}`, 'utf8');
  const byName = (days: ReturnType<typeof parseWorkoutText>) =>
    Object.fromEntries(days[0].exercises.map((e) => [e.name, e]));

  it('reads the upper-body sheet as one workout with sets, reps, rest and notes', () => {
    const days = parseWorkoutText(fixture('ficha-superiores.txt'));
    expect(days).toHaveLength(1);
    expect(days[0].dayOfWeek).toBeNull();
    expect(days[0].exercises).toHaveLength(15);
    const ex = byName(days);

    expect(ex['Remada Curvada carga leve']).toMatchObject({ scheme: '3x12', restSeconds: null, notes: 'Aquecimento' });
    expect(ex['Skipping']).toMatchObject({ scheme: '3x30s' });
    expect(ex['Remada Curvada Pronada barra livre']).toMatchObject({ scheme: '5x9-11', restSeconds: 40 });
    expect(ex['Supino Reto máquina deitado']).toMatchObject({ scheme: '4x14-16/10-12/10-12/6-8', restSeconds: 40 });
    expect(ex['Supino Reto máquina deitado'].notes).toContain('se não tiver pode fazer o sentado');
    expect(ex['Supino Reto máquina deitado'].notes).toContain('DESCANSO: 40” (volta para a Remada)');
    expect(ex['Elevação lateral']).toMatchObject({ scheme: '4x20-22/12-14/12-14/9-11', restSeconds: 40 });
    expect(ex['Elevação lateral'].notes).toContain('faz mais 7 a 9 na cadência');
    expect(ex['Desenvolvimento de ombros máquina sentado']).toMatchObject({ scheme: '3x20-22/13-15/8-10' });
    expect(ex['Triceps Testa']).toMatchObject({ scheme: '3x16-18/16-18/10-12', restSeconds: 30 });
    expect(ex['Pull down barra reta (polia alta)']).toMatchObject({ scheme: '2x12-14', restSeconds: 45 });
    expect(days[0].exercises.filter((e) => e.name === 'Cardio').map((e) => e.scheme)).toEqual(['4x40s', '3x30s']);
    // "(ver vídeo)" never ends up in a name
    expect(days[0].exercises.some((e) => /v[íi]deo/i.test(e.name))).toBe(false);
  });

  it('reads the lower-body sheet, including ranges of rest and inline reps', () => {
    const days = parseWorkoutText(fixture('ficha-inferiores.txt'));
    expect(days[0].exercises).toHaveLength(11);
    const ex = byName(days);

    expect(ex['Afundo']).toMatchObject({ scheme: '3x6' });
    expect(ex['Afundo'].notes).toContain('com cada perna');
    expect(ex['Butt Kick']).toMatchObject({ scheme: '3x22' });
    expect(ex['Afundo com halteres (step no pé da frente)']).toMatchObject({
      scheme: '4x16-18/11-13/11-13/8-10',
      restSeconds: 30,
    });
    expect(ex['Agachamento barra guiada Smith']).toMatchObject({ scheme: '5x24-26/14-16/14-16/14-16/8-10', restSeconds: 80 });
    expect(ex['Elevação Pélvica máquina']).toMatchObject({ scheme: '3x13-15', restSeconds: 80 });
    expect(ex['Stiff barra livre']).toMatchObject({ scheme: '3x14-16', restSeconds: 80 });
    expect(ex['Cadeira extensora']).toMatchObject({ scheme: '3x14-16', restSeconds: 60 });
    expect(ex['Mesa Flexora']).toMatchObject({ scheme: '3x14-16', restSeconds: 45 });
    expect(ex['Glúteo na polia (perna esticada)']).toMatchObject({ scheme: '1x11-13', restSeconds: null });
  });

  it('uses an explicit NxR on the exercise line over the block sets', () => {
    const [day] = parseWorkoutText('PARTE 1: 4 SÉRIES\n-Supino 4x10\n-Elevação lateral 3x15 (ver vídeo)\nDESCANSO: 40”');
    expect(day.exercises).toEqual([
      { name: 'Supino', scheme: '4x10', restSeconds: 40 },
      { name: 'Elevação lateral', scheme: '3x15', restSeconds: 40 },
    ]);
  });

  it('keeps simple lists on the simple parser', () => {
    expect(parseWorkoutText('Segunda\n- Supino 4x10\n- Crucifixo 3x12')[0]).toMatchObject({
      dayOfWeek: 1,
      exercises: [{ name: 'Supino', scheme: '4x10' }, { name: 'Crucifixo', scheme: '3x12' }],
    });
  });
});
