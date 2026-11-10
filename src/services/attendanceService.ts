import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import { localDateKey } from '../utils/date';
import { createRequestCache } from './requestCache';

async function getLocalDb() {
  const { getDb } = await import('../db');
  return getDb();
}

type MonthAttendance = { dates: Set<string>; totalDays: number };

const ATTENDANCE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — attendance changes at most once per workout
const attendanceCache = createRequestCache<string, MonthAttendance>(ATTENDANCE_CACHE_TTL_MS);

type MonthParams = { userId: number; year: number; month: number };

// Month normalised like Date does (month -1 = December of the previous year).
function monthKey({ userId, year, month }: MonthParams): string {
  const first = new Date(year, month, 1);
  return `${userId}:${first.getFullYear()}:${first.getMonth()}`;
}

/** Last known check-ins of a month, for the calendar's first frame. */
export function getCachedAttendanceMonth(params: MonthParams): MonthAttendance | null {
  return attendanceCache.peek(monthKey(params)) ?? null;
}

export function getAttendanceDatesByMonth(params: MonthParams): Promise<MonthAttendance> {
  return attendanceCache.get(monthKey(params), () => fetchAttendanceMonth(params));
}

async function fetchAttendanceMonth(params: MonthParams): Promise<MonthAttendance> {

  const firstDay = new Date(params.year, params.month, 1);
  const lastDay = new Date(params.year, params.month + 1, 0);
  const from = localDateKey(firstDay);
  const to = localDateKey(lastDay);

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase
      .from('attendance')
      .select('date')
      .eq('user_id', params.userId)
      .gte('date', from)
      .lte('date', to);
    if (error) throw error;
    const response = {
      dates: new Set((data ?? []).map((row) => {
        // Supabase may return full ISO timestamps — normalize to local YYYY-MM-DD
        const raw = String(row.date);
        if (raw.length > 10) {
          return localDateKey(new Date(raw));
        }
        return raw;
      })),
      totalDays: lastDay.getDate(),
    };
    return response;
  }

  const db = await getLocalDb();
  const rows = await db.getAllAsync<{ date: string }>(
    `SELECT date FROM attendance WHERE user_id = ? AND date BETWEEN ? AND ?;`,
    params.userId,
    from,
    to,
  );
  const response = {
    dates: new Set(rows.map((row) => row.date)),
    totalDays: lastDay.getDate(),
  };
  return response;
}

export function invalidateAttendanceCache(userId: number) {
  attendanceCache.invalidate((key) => key.startsWith(`${userId}:`));
}

export async function markAttendance(userId: number, date: Date) {
  const dateStr = localDateKey(date);

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { error } = await supabase.from('attendance').upsert(
      {
        user_id: userId,
        date: dateStr,
      },
      { onConflict: 'user_id,date' },
    );
    if (error) throw error;
  } else {
    const db = await getLocalDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO attendance (user_id, date) VALUES (?, ?);`,
      userId,
      dateStr,
    );
  }

  invalidateAttendanceCache(userId);
}
