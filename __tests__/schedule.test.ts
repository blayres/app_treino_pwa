import { describe, expect, it } from '@jest/globals';
import { locales as translations } from '../src/i18n/translations';
import { nextInSequence, scheduleOf, slotLabel } from '../src/utils/schedule';

const w = (id: number, slot: number, lastDone: string | null, title = `T${id}`) => ({
  id,
  day_of_week: slot,
  title,
  last_done: lastDone,
});

describe('scheduleOf', () => {
  it('is weekly unless a workout is marked as a sequence (old rows have no column)', () => {
    expect(scheduleOf([])).toBe('week');
    expect(scheduleOf([{}, { schedule: null }, { schedule: 'week' }])).toBe('week');
    expect(scheduleOf([{ schedule: 'week' }, { schedule: 'sequence' }])).toBe('sequence');
  });
});

describe('slotLabel', () => {
  it('names a weekday or a position, in every language', () => {
    expect(slotLabel(translations.pt, 'week', 1)).toBe('Segunda');
    expect(slotLabel(translations.pt, 'sequence', 2)).toBe('Treino 2');
    expect(slotLabel(translations.fr, 'sequence', 3)).toBe('Séance 3');
    expect(slotLabel(translations.en, 'sequence', 1)).toBe('Workout 1');
    expect(slotLabel(translations.es, 'sequence', 1)).toBe('Entreno 1');
  });
});

describe('nextInSequence', () => {
  it('starts with the first workout when none was done', () => {
    expect(nextInSequence([w(30, 3, null), w(10, 1, null), w(20, 2, null)])).toBe(10);
  });

  it('suggests the one after the most recently done, back to the first after the last', () => {
    expect(nextInSequence([w(10, 1, '2026-11-20T10:00:00Z'), w(20, 2, '2026-11-22T10:00:00Z'), w(30, 3, null)])).toBe(30);
    expect(nextInSequence([w(10, 1, '2026-11-20T10:00:00Z'), w(20, 2, '2026-11-21T10:00:00Z'), w(30, 3, '2026-11-23T10:00:00Z')])).toBe(10);
    // Done out of order: what counts is the latest one.
    expect(nextInSequence([w(10, 1, '2026-11-24T10:00:00Z'), w(20, 2, '2026-11-21T10:00:00Z'), w(30, 3, null)])).toBe(20);
  });

  it('skips rest days and copes with an empty program', () => {
    expect(nextInSequence([w(10, 1, '2026-11-20T10:00:00Z'), w(20, 2, null, 'Repouso'), w(30, 3, null)])).toBe(30);
    expect(nextInSequence([])).toBeNull();
  });
});
