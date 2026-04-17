import { getDb } from '../db';
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';

const ATTENDANCE_CACHE_TTL_MS = 20_000;
const attendanceCache = new Map<string, { expiresAt: number; data: { dates: Set<string>; totalDays: number } }>();

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getAttendanceDatesByMonth(params: {
  userId: number;
  year: number;
  month: number;
}): Promise<{ dates: Set<string>; totalDays: number }> {
  const cacheKey = `${params.userId}:${params.year}:${params.month}`;
  const cached = attendanceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const firstDay = new Date(params.year, params.month, 1);
  const lastDay = new Date(params.year, params.month + 1, 0);
  const from = formatLocalDate(firstDay);
  const to = formatLocalDate(lastDay);

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
          return formatLocalDate(new Date(raw));
        }
        return raw;
      })),
      totalDays: lastDay.getDate(),
    };
    attendanceCache.set(cacheKey, {
      expiresAt: Date.now() + ATTENDANCE_CACHE_TTL_MS,
      data: response,
    });
    return response;
  }

  const db = await getDb();
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
  attendanceCache.set(cacheKey, {
    expiresAt: Date.now() + ATTENDANCE_CACHE_TTL_MS,
    data: response,
  });
  return response;
}

export async function markAttendance(userId: number, date: Date) {
  const dateStr = formatLocalDate(date);

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
    const db = await getDb();
    await db.runAsync(
      `INSERT OR IGNORE INTO attendance (user_id, date) VALUES (?, ?);`,
      userId,
      dateStr,
    );
  }

  for (const cacheKey of attendanceCache.keys()) {
    if (cacheKey.startsWith(`${userId}:`)) {
      attendanceCache.delete(cacheKey);
    }
  }
}
