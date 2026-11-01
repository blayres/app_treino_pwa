/**
 * Personal trainer ("Área do personal"): invite code, coach ↔ student link and
 * the students' activity summary. Authorization lives in the database
 * (migration_coach.sql): a coach only ever reads students linked to them.
 */
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import { calendarDaysBetween } from '../utils/date';

export type StudentSummary = {
  id: number;
  name: string;
  /** When the student joined this coach (ISO). */
  since: string;
  /** Latest completed workout (ISO) or null if never trained. */
  lastWorkoutAt: string | null;
  sessionsLast7: number;
  sessionsLast30: number;
  /** Active training days in the program (0 = coach still has to build it). */
  programDays: number;
};

/** What the coach should notice first about a student. */
export type StudentStatus = 'noProgram' | 'neverTrained' | 'active' | 'slipping' | 'inactive';

export const SLIPPING_AFTER_DAYS = 4;
export const INACTIVE_AFTER_DAYS = 10;

export class CoachCodeError extends Error {
  constructor(public reason: 'invalid' | 'own') {
    super(reason === 'invalid' ? 'INVALID_COACH_CODE' : 'OWN_COACH_CODE');
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function studentStatus(student: StudentSummary, now: Date): StudentStatus {
  if (student.programDays === 0) return 'noProgram';
  if (!student.lastWorkoutAt) return 'neverTrained';
  const idle = calendarDaysBetween(new Date(student.lastWorkoutAt), now);
  if (idle >= INACTIVE_AFTER_DAYS) return 'inactive';
  if (idle >= SLIPPING_AFTER_DAYS) return 'slipping';
  return 'active';
}

/** Students needing the coach (no program, stopped training) — for the summary line. */
export function countNeedingAttention(students: StudentSummary[], now: Date): number {
  return students.filter((s) => ['noProgram', 'inactive'].includes(studentStatus(s, now))).length;
}

/** Case- and accent-insensitive name search. */
export function filterStudents(students: StudentSummary[], query: string): StudentSummary[] {
  const key = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const q = key(query);
  return q ? students.filter((s) => key(s.name).includes(q)) : students;
}

export function buildStudentSummaries(
  links: { student_id: number; created_at: string; name: string }[],
  lastDone: { user_id: number; last_done: string }[],
  recentSessions: { user_id: number; ended_at: string }[],
  activeWorkouts: { user_id: number }[],
  now: Date,
): StudentSummary[] {
  const weekAgo = now.getTime() - 7 * 86_400_000;
  return links
    .map((link) => {
      const id = Number(link.student_id);
      const last = lastDone
        .filter((r) => Number(r.user_id) === id)
        .reduce<string | null>((max, r) => (!max || r.last_done > max ? r.last_done : max), null);
      const sessions = recentSessions.filter((r) => Number(r.user_id) === id);
      return {
        id,
        name: link.name,
        since: link.created_at,
        lastWorkoutAt: last,
        sessionsLast30: sessions.length,
        sessionsLast7: sessions.filter((r) => new Date(r.ended_at).getTime() >= weekAgo).length,
        programDays: activeWorkouts.filter((w) => Number(w.user_id) === id).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Link shared by the coach: opening it offers to join (see coachInvite.ts). */
export function inviteLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/convite/${code}`;
}

// ── Data access (Supabase only: coaching needs the server) ─────────────────────

function requireSupabase() {
  if (backendMode !== 'supabase') throw new Error('Coaching requires the online backend.');
  ensureSupabaseEnabled();
}

/** The user's invite code, or null if they are not a coach yet. */
export async function getCoachCode(userId: number): Promise<string | null> {
  requireSupabase();
  const { data, error } = await supabase.from('profiles').select('coach_code').eq('id', userId).maybeSingle();
  if (error) return null;
  return (data as any)?.coach_code ?? null;
}

/** Become a coach (returns the invite code); reset = new code, old link stops working. */
export async function becomeCoach(reset = false): Promise<string> {
  requireSupabase();
  const { data, error } = await supabase.rpc('become_coach', { p_reset: reset });
  if (error) throw error;
  return String(data);
}

export async function getInviteCoachName(code: string): Promise<string | null> {
  requireSupabase();
  const { data, error } = await supabase.rpc('coach_invite_name', { p_code: code });
  if (error) throw error;
  return data ? String(data) : null;
}

/** Join a coach by code; returns the coach's name. */
export async function joinCoach(code: string): Promise<string> {
  requireSupabase();
  const { data, error } = await supabase.rpc('join_coach', { p_code: code.trim() });
  if (error) {
    const message = String((error as any).message ?? '');
    if (message.includes('INVALID_COACH_CODE')) throw new CoachCodeError('invalid');
    if (message.includes('OWN_COACH_CODE')) throw new CoachCodeError('own');
    throw error;
  }
  return String(data);
}

export async function getMyCoach(): Promise<{ id: number; name: string } | null> {
  if (backendMode !== 'supabase') return null;
  ensureSupabaseEnabled();
  const { data, error } = await supabase.rpc('my_coach');
  if (error) return null; // migration not applied yet
  const row = (data as any[] | null)?.[0];
  return row ? { id: Number(row.coach_id), name: String(row.coach_name) } : null;
}

/** Ends the coach ↔ student link (used by both sides; RLS checks who may). */
export async function unlinkStudent(studentId: number): Promise<void> {
  requireSupabase();
  const { error } = await supabase.from('coach_students').delete().eq('student_id', studentId);
  if (error) throw error;
}

async function summarize(links: { student_id: number; created_at: string; name: string }[]) {
  if (links.length === 0) return [];
  const ids = links.map((l) => l.student_id);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [lastDone, sessions, workouts] = await Promise.all([
    supabase.from('workout_last_done').select('user_id, last_done').in('user_id', ids),
    supabase
      .from('workout_sessions')
      .select('user_id, ended_at')
      .in('user_id', ids)
      .eq('completed', 1)
      .gte('ended_at', monthAgo),
    supabase.from('workouts').select('user_id').in('user_id', ids).is('archived_at', null),
  ]);
  for (const res of [lastDone, sessions, workouts]) if (res.error) throw res.error;
  return buildStudentSummaries(
    links,
    (lastDone.data ?? []) as any[],
    (sessions.data ?? []) as any[],
    (workouts.data ?? []) as any[],
    new Date(),
  );
}

const toLinks = (rows: any[]) =>
  rows.map((row) => ({
    student_id: Number(row.student_id),
    created_at: String(row.created_at),
    name: String(row.student?.name ?? '—'),
  }));

/** The coach's students with activity, sorted by name. */
export async function listStudents(coachId: number): Promise<StudentSummary[]> {
  requireSupabase();
  const { data, error } = await supabase
    .from('coach_students')
    .select('student_id, created_at, student:student_id ( name )')
    .eq('coach_id', coachId);
  if (error) throw error;
  return summarize(toLinks(data ?? []));
}

/** One student of the coach, or null if not linked (anymore). */
export async function getStudent(coachId: number, studentId: number): Promise<StudentSummary | null> {
  requireSupabase();
  const { data, error } = await supabase
    .from('coach_students')
    .select('student_id, created_at, student:student_id ( name )')
    .eq('coach_id', coachId)
    .eq('student_id', studentId);
  if (error) throw error;
  const [student] = await summarize(toLinks(data ?? []));
  return student ?? null;
}

/** i18n key for a failed join, or null when it is not a code problem. */
export function joinErrorKey(err: unknown): 'invalidCoachCode' | 'ownCoachCode' | null {
  if (!(err instanceof CoachCodeError)) return null;
  return err.reason === 'own' ? 'ownCoachCode' : 'invalidCoachCode';
}
