/**
 * Calendar-day helpers in the device's time zone (where the user trains).
 * Never hard-code a time zone: users are in Brazil, France, etc.
 */

/** YYYY-MM-DD of the given instant in the device's local time zone. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole calendar days between two instants (local days, DST-safe). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86_400_000);
}

/** Whole calendar months between two instants (local). */
export function calendarMonthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export type RelativeDay =
  | { unit: 'today' }
  | { unit: 'days'; value: number }
  | { unit: 'weeks'; value: number }
  | { unit: 'months'; value: number };

/** How long ago a workout was done, in the largest sensible unit. */
export function relativeDay(done: Date, now: Date): RelativeDay {
  const days = calendarDaysBetween(done, now);
  if (days <= 0) return { unit: 'today' };
  if (days < 7) return { unit: 'days', value: days };
  const months = calendarMonthsBetween(done, now);
  if (months < 1) return { unit: 'weeks', value: Math.floor(days / 7) };
  return { unit: 'months', value: months };
}

/** Rest/duration label: 90 → "1min 30s", 60 → "1min", 45 → "45s" (units from i18n). */
export function formatRest(seconds: number, minuteShort: string, secondShort: string): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes > 0 && rest > 0) return `${minutes}${minuteShort} ${rest}${secondShort}`;
  if (minutes > 0) return `${minutes}${minuteShort}`;
  return `${rest}${secondShort}`;
}

export type StartedDay = {
  /** Calendar position of the start relative to now. */
  when: 'today' | 'yesterday' | 'earlier';
  /** "seg., 9/11" — weekday + day/month in the locale. */
  weekdayDate: string;
  /** "9/11" — day/month in the locale. */
  shortDate: string;
  /** "18:40" — hours and minutes in the locale. */
  time: string;
};

/** Describes when something started, for "you started … at …" messages. */
export function describeStartedDay(started: Date, now: Date, localeTagValue: string): StartedDay {
  const days = calendarDaysBetween(started, now);
  return {
    when: days <= 0 ? 'today' : days === 1 ? 'yesterday' : 'earlier',
    weekdayDate: new Intl.DateTimeFormat(localeTagValue, { weekday: 'short', day: 'numeric', month: 'numeric' }).format(started),
    shortDate: new Intl.DateTimeFormat(localeTagValue, { day: 'numeric', month: 'numeric' }).format(started),
    time: new Intl.DateTimeFormat(localeTagValue, { hour: '2-digit', minute: '2-digit' }).format(started),
  };
}

export type CalendarDay = {
  /** YYYY-MM-DD, '' for the padding cells before/after the month. */
  date: string;
  label: string;
  isEmpty: boolean;
};

/**
 * Weeks (Sunday first) of a month for the frequency calendar. Pure and
 * synchronous: the grid never waits for the network, only the check-ins do.
 */
export function buildMonthWeeks(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: CalendarDay[] = [];
  for (let i = 0; i < first.getDay(); i++) days.push({ date: '', label: '', isEmpty: true });
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: localDateKey(new Date(year, month, d)), label: String(d), isEmpty: false });
  }
  for (let i = last.getDay(); i < 6; i++) days.push({ date: '', label: '', isEmpty: true });
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}
