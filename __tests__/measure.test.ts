import { describe, expect, it } from '@jest/globals';
import {
  formatSeconds,
  isTimeScheme,
  schemeMeasure,
  switchSchemeMeasure,
  targetSeconds,
  timedExerciseIds,
} from '../src/utils/measure';

describe('schemeMeasure', () => {
  it.each(['3x30s', '3x30-45s', '4x1min', '3 x 40 seg', '3x45"', '3x20 segundos', '2x1-2min', '3x30s e 1x falha'])(
    'reads %s as time',
    (scheme) => expect(schemeMeasure(scheme)).toBe('time'),
  );

  it.each(['3x10-12', '4x8', '4 séries', '3 séries de 12', 'aquecimento', '3x12 e 1x falha', '', null, undefined])(
    'reads %s as load',
    (scheme) => expect(schemeMeasure(scheme as any)).toBe('load'),
  );

  it('only looks at the main part (before " e ")', () => {
    expect(isTimeScheme('3x12 e 1x30s')).toBe(false);
  });
});

describe('switchSchemeMeasure', () => {
  it('keeps the number of sets and swaps the reps', () => {
    expect(switchSchemeMeasure('4x10-12', 'time')).toBe('4x30s');
    expect(switchSchemeMeasure('4x30-45s', 'load')).toBe('4x10-12');
  });

  it('defaults to 3 sets when the scheme has none, and leaves it alone if already right', () => {
    expect(switchSchemeMeasure('aquecimento', 'time')).toBe('3x30s');
    expect(switchSchemeMeasure('5 séries', 'time')).toBe('5x30s');
    expect(switchSchemeMeasure('3x45s', 'time')).toBe('3x45s');
    expect(switchSchemeMeasure('3x10', 'load')).toBe('3x10');
  });
});

describe('targetSeconds', () => {
  it('uses the upper end of a range and converts minutes', () => {
    expect(targetSeconds('3x30-45s')).toBe(45);
    expect(targetSeconds('3x30s')).toBe(30);
    expect(targetSeconds('4x1min')).toBe(60);
    expect(targetSeconds('2x1-2min')).toBe(120);
    expect(targetSeconds('3x1,5min')).toBe(90);
  });

  it('is null for load schemes', () => {
    expect(targetSeconds('3x10-12')).toBeNull();
  });
});

describe('formatSeconds', () => {
  it('shows seconds, minutes, or both', () => {
    expect(formatSeconds(45)).toBe('45 s');
    expect(formatSeconds(60)).toBe('1 min');
    expect(formatSeconds(90)).toBe('1 min 30 s');
  });
});

describe('timedExerciseIds', () => {
  it('collects the exercises whose effective scheme is timed', () => {
    const rows = [
      { exercise: { id: 1, scheme: '3x30s' } },
      { exercise: { id: 2, scheme: '3x10-12' } },
      { exercise: { id: 3, scheme: '4x1min' } },
    ];
    expect([...timedExerciseIds(rows)]).toEqual([1, 3]);
  });
});
