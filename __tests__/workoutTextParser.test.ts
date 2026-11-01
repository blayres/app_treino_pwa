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
