import { ensureSupabaseEnabled, supabase } from './supabaseClient';

export type StudentStats = {
  checkedInToday: boolean;
  weeklyFrequency: number;       // completed sessions in the last 7 days
  lastDurationMinutes: number;   // duration of the most recent completed session
  loads: LoadRow[];
};

export type LoadRow = {
  exercise_id: number;
  exercise_name: string;
  load_kg: number | null;
  progression_kg: number | null;
  updated_at: string;
};

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getStudentStats(userId: number): Promise<StudentStats> {
  ensureSupabaseEnabled();

  const todayStr = localDateStr(new Date());
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [attendanceRes, lastSessionRes, weeklySessionsRes, loadsRes] = await Promise.all([
    // Today's check-in
    supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date', todayStr),

    // Most recent completed session for last duration
    supabase
      .from('workout_sessions')
      .select('duration_seconds, ended_at')
      .eq('user_id', userId)
      .eq('completed', 1)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1),

    // All completed sessions in last 7 days for weekly frequency
    supabase
      .from('workout_sessions')
      .select('ended_at')
      .eq('user_id', userId)
      .eq('completed', 1)
      .not('ended_at', 'is', null)
      .gte('ended_at', sevenDaysAgo.toISOString()),

    // Exercise loads joined with exercise name
    supabase
      .from('exercise_loads')
      .select('exercise_id, load_kg, progression_kg, updated_at, exercises(name)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ]);

  // Check-in today
  const checkedInToday = (attendanceRes.count ?? 0) > 0;

  // Last session duration
  const lastSession = lastSessionRes.data?.[0];
  const lastDurationMinutes =
    lastSession?.duration_seconds != null && lastSession.duration_seconds > 0
      ? Math.round(lastSession.duration_seconds / 60)
      : 0;

  // Weekly frequency
  const weeklyFrequency = weeklySessionsRes.data?.length ?? 0;

  // Loads
  const loads: LoadRow[] = (loadsRes.data ?? []).map((row: any) => ({
    exercise_id: Number(row.exercise_id),
    exercise_name: String(row.exercises?.name ?? '—'),
    load_kg: row.load_kg != null ? Number(row.load_kg) : null,
    progression_kg: row.progression_kg != null ? Number(row.progression_kg) : null,
    updated_at: String(row.updated_at),
  }));

  return { checkedInToday, weeklyFrequency, lastDurationMinutes, loads };
}
