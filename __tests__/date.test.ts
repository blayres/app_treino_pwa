import { describe, expect, it } from '@jest/globals';
import { buildMonthWeeks, calendarDaysBetween, describeStartedDay, localDateKey, relativeDay , formatRest } from '../src/utils/date';

// Dates are built in the machine's local time zone, like the app does on the phone.
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

describe('localDateKey', () => {
  it('uses the local calendar day (late evening is still the same day)', () => {
    expect(localDateKey(at(2026, 11, 1, 23, 50))).toBe('2026-11-01');
    expect(localDateKey(at(2026, 2, 3, 0, 5))).toBe('2026-02-03');
  });
});

describe('calendarDaysBetween', () => {
  it('counts calendar days, not 24h blocks', () => {
    expect(calendarDaysBetween(at(2026, 11, 1, 23, 50), at(2026, 11, 2, 0, 10))).toBe(1);
    expect(calendarDaysBetween(at(2026, 11, 2, 0, 10), at(2026, 11, 2, 23, 50))).toBe(0);
    expect(calendarDaysBetween(at(2026, 3, 28), at(2026, 3, 30))).toBe(2); // across a DST change in Europe
  });
});

describe('relativeDay', () => {
  const now = at(2026, 11, 20);
  it.each([
    [at(2026, 11, 20, 6), { unit: 'today' }],
    [at(2026, 11, 19, 23, 59), { unit: 'days', value: 1 }],
    [at(2026, 11, 14), { unit: 'days', value: 6 }],
    [at(2026, 11, 13), { unit: 'weeks', value: 1 }],
    [at(2026, 11, 2), { unit: 'weeks', value: 2 }],
    [at(2026, 10, 20), { unit: 'months', value: 1 }],
    [at(2026, 5, 1), { unit: 'months', value: 6 }],
  ])('%s → %o', (done, expected) => {
    expect(relativeDay(done as Date, now)).toEqual(expected);
  });

  it('a workout done "in the future" (clock skew) counts as today', () => {
    expect(relativeDay(at(2026, 11, 21), now)).toEqual({ unit: 'today' });
  });
});


describe('formatRest', () => {
  it.each([
    [90, '1min 30s'],
    [60, '1min'],
    [45, '45s'],
    [0, '0s'],
  ])('%s s → %s', (seconds, label) => {
    expect(formatRest(seconds as number, 'min', 's')).toBe(label);
  });
});

describe('describeStartedDay', () => {
  const now = at(2026, 11, 10, 6, 38);

  it('says today / yesterday / earlier by calendar day, not 24h blocks', () => {
    expect(describeStartedDay(at(2026, 11, 10, 0, 5), now, 'pt-BR').when).toBe('today');
    expect(describeStartedDay(at(2026, 11, 9, 23, 50), now, 'pt-BR').when).toBe('yesterday');
    expect(describeStartedDay(at(2026, 11, 7, 18, 0), now, 'pt-BR').when).toBe('earlier');
  });

  it('formats the date and time in the user language', () => {
    const day = describeStartedDay(at(2026, 11, 9, 18, 40), now, 'pt-BR');
    expect(day.shortDate).toBe('09/11');
    expect(day.time).toBe('18:40');
    expect(day.weekdayDate).toMatch(/^seg/);
    expect(describeStartedDay(at(2026, 11, 9, 18, 40), now, 'en-US').shortDate).toBe('11/9');
  });
});

describe('buildMonthWeeks', () => {
  it('lays out a month in Sunday-first weeks with padding cells', () => {
    const weeks = buildMonthWeeks(2026, 10); // November 2026 starts on a Sunday
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toEqual({ date: '2026-11-01', label: '1', isEmpty: false });
    expect(weeks[4][1]).toEqual({ date: '2026-11-30', label: '30', isEmpty: false });
    expect(weeks[4][2].isEmpty).toBe(true);
  });

  it('pads before the first day', () => {
    const weeks = buildMonthWeeks(2026, 9); // October 2026 starts on a Thursday
    expect(weeks[0].slice(0, 4).every((d) => d.isEmpty)).toBe(true);
    expect(weeks[0][4].date).toBe('2026-10-01');
  });
});
