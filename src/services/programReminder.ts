/**
 * "Hora de atualizar o treino" reminder.
 *
 * Rule: since the current program cycle started, count calendar months with
 * at least MIN_DAYS_PER_MONTH trained days (attendance). When QUALIFYING_MONTHS
 * of them are reached, remind the user (unless snoozed). Months don't need to
 * be consecutive; a month with fewer days simply doesn't count.
 *
 * The cycle restarts when the program is saved/replaced or the user says they
 * already updated it.
 */
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import { localDateKey } from '../utils/date';

export const MIN_DAYS_PER_MONTH = 14;
export const QUALIFYING_MONTHS = 2;
export const SNOOZE_DAYS = 7;

// Postgres "undefined_column": migration_program_reminder.sql not applied yet.
const UNDEFINED_COLUMN = '42703';

export type ReminderProgress = {
  /** Months (YYYY-MM) that already count, oldest first. */
  qualifyingMonths: string[];
  /** Trained days per month since the cycle started. */
  daysByMonth: Record<string, number>;
  due: boolean;
};

/** Pure: is the reminder due for these trained days (YYYY-MM-DD) since `cycleStart`? */
export function evaluateProgramReminder(params: {
  trainedDates: string[];
  cycleStart: Date;
  now: Date;
  snoozedUntil?: Date | null;
}): ReminderProgress {
  const startKey = localDateKey(params.cycleStart);
  const daysByMonth: Record<string, number> = {};
  for (const date of new Set(params.trainedDates)) {
    if (date < startKey) continue;
    const month = date.slice(0, 7);
    daysByMonth[month] = (daysByMonth[month] ?? 0) + 1;
  }
  const qualifyingMonths = Object.keys(daysByMonth)
    .filter((month) => daysByMonth[month] >= MIN_DAYS_PER_MONTH)
    .sort();
  const snoozed = params.snoozedUntil != null && params.snoozedUntil > params.now;
  return {
    qualifyingMonths,
    daysByMonth,
    due: qualifyingMonths.length >= QUALIFYING_MONTHS && !snoozed,
  };
}

/** Reads the cycle and the trained days and tells whether to show the reminder. */
export async function getProgramReminder(userId: number, now = new Date()): Promise<ReminderProgress | null> {
  if (backendMode !== 'supabase') return null;
  ensureSupabaseEnabled();

  const profile = await supabase
    .from('profiles')
    .select('program_cycle_started_at, program_reminder_snoozed_until')
    .eq('id', userId)
    .maybeSingle();
  if (profile.error) {
    if (profile.error.code === UNDEFINED_COLUMN) return null; // migration not applied yet
    throw profile.error;
  }
  if (!profile.data) return null;

  const cycleStart = new Date(String(profile.data.program_cycle_started_at));
  const { data, error } = await supabase
    .from('attendance')
    .select('date')
    .eq('user_id', userId)
    .gte('date', localDateKey(cycleStart));
  if (error) throw error;

  return evaluateProgramReminder({
    trainedDates: (data ?? []).map((row: any) => String(row.date).slice(0, 10)),
    cycleStart,
    now,
    snoozedUntil: profile.data.program_reminder_snoozed_until
      ? new Date(String(profile.data.program_reminder_snoozed_until))
      : null,
  });
}

async function updateProfile(userId: number, patch: Record<string, string | null>) {
  if (backendMode !== 'supabase') return;
  ensureSupabaseEnabled();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error && error.code !== UNDEFINED_COLUMN) throw error;
}

/** Program updated (saved/replaced, or "Já atualizei"): start a new cycle. */
export function restartProgramCycle(userId: number, now = new Date()): Promise<void> {
  return updateProfile(userId, {
    program_cycle_started_at: now.toISOString(),
    program_reminder_snoozed_until: null,
  });
}

/** "Lembrar depois": hide the reminder for SNOOZE_DAYS. */
export function snoozeProgramReminder(userId: number, now = new Date()): Promise<void> {
  const until = new Date(now.getTime() + SNOOZE_DAYS * 86_400_000);
  return updateProfile(userId, { program_reminder_snoozed_until: until.toISOString() });
}
