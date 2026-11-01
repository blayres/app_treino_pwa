import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  buildStudentSummaries,
  CoachCodeError,
  countNeedingAttention,
  filterStudents,
  getMyCoach,
  inviteLink,
  joinCoach,
  joinErrorKey,
  listStudents,
  studentStatus,
  unlinkStudent,
  type StudentSummary,
} from '../src/services/coachService';

const now = new Date(2026, 10, 20, 12);
const daysAgo = (n: number) => new Date(2026, 10, 20 - n, 9).toISOString();
const student = (over: Partial<StudentSummary> = {}): StudentSummary => ({
  id: 1,
  name: 'Ana',
  since: daysAgo(60),
  lastWorkoutAt: daysAgo(1),
  sessionsLast7: 2,
  sessionsLast30: 9,
  programDays: 4,
  ...over,
});

describe('studentStatus', () => {
  it('flags what the coach must act on first', () => {
    expect(studentStatus(student({ programDays: 0, lastWorkoutAt: null }), now)).toBe('noProgram');
    expect(studentStatus(student({ lastWorkoutAt: null }), now)).toBe('neverTrained');
    expect(studentStatus(student({ lastWorkoutAt: daysAgo(0) }), now)).toBe('active');
    expect(studentStatus(student({ lastWorkoutAt: daysAgo(3) }), now)).toBe('active');
    expect(studentStatus(student({ lastWorkoutAt: daysAgo(4) }), now)).toBe('slipping');
    expect(studentStatus(student({ lastWorkoutAt: daysAgo(10) }), now)).toBe('inactive');
  });

  it('counts students needing attention (no program or stopped)', () => {
    const list = [
      student({ id: 1, programDays: 0 }),
      student({ id: 2, lastWorkoutAt: daysAgo(15) }),
      student({ id: 3, lastWorkoutAt: daysAgo(5) }),
      student({ id: 4 }),
    ];
    expect(countNeedingAttention(list, now)).toBe(2);
  });
});

describe('filterStudents', () => {
  it('ignores case and accents', () => {
    const list = [student({ id: 1, name: 'Júlia Souza' }), student({ id: 2, name: 'Marcos' })];
    expect(filterStudents(list, 'juli').map((s) => s.id)).toEqual([1]);
    expect(filterStudents(list, '  ')).toHaveLength(2);
  });
});

describe('buildStudentSummaries', () => {
  it('aggregates last workout, 7/30-day counts and program days per student, sorted by name', () => {
    const result = buildStudentSummaries(
      [
        { student_id: 2, created_at: daysAgo(30), name: 'Bruno' },
        { student_id: 1, created_at: daysAgo(90), name: 'Ana' },
      ],
      [
        { user_id: 1, last_done: daysAgo(9) },
        { user_id: 1, last_done: daysAgo(2) },
      ],
      [
        { user_id: 1, ended_at: daysAgo(2) },
        { user_id: 1, ended_at: daysAgo(12) },
      ],
      [{ user_id: 1 }, { user_id: 1 }, { user_id: 1 }],
      now,
    );
    expect(result.map((s) => s.name)).toEqual(['Ana', 'Bruno']);
    expect(result[0]).toMatchObject({ lastWorkoutAt: daysAgo(2), sessionsLast7: 1, sessionsLast30: 2, programDays: 3 });
    expect(result[1]).toMatchObject({ lastWorkoutAt: null, sessionsLast7: 0, programDays: 0 });
  });
});

describe('inviteLink', () => {
  it('builds /convite/CODE on the app origin', () => {
    expect(inviteLink('https://app.example/', 'AB2CD3')).toBe('https://app.example/convite/AB2CD3');
  });
});

describe('data access', () => {
  beforeEach(() => supabaseMock.reset());

  it('lists only the coach\'s students and batches the activity queries', async () => {
    supabaseMock.queue('coach_students.select', {
      data: [{ student_id: 7, created_at: daysAgo(10), student: { name: 'Carla' } }],
    });
    supabaseMock.queue('workouts.select', { data: [{ user_id: 7 }] });

    const result = await listStudents(3);

    expect(result).toEqual([expect.objectContaining({ id: 7, name: 'Carla', programDays: 1 })]);
    const [links] = supabaseMock.calls('coach_students', 'select');
    expect(filter(links, 'eq', 'coach_id')).toEqual(['eq', 'coach_id', 3]);
    for (const table of ['workout_last_done', 'workout_sessions', 'workouts']) {
      const [query] = supabaseMock.calls(table, 'select');
      expect(filter(query, 'in', 'user_id')).toEqual(['in', 'user_id', [7]]);
    }
  });

  it('does not query activity when there are no students', async () => {
    supabaseMock.queue('coach_students.select', { data: [] });
    expect(await listStudents(3)).toEqual([]);
    expect(supabaseMock.calls('workout_sessions')).toHaveLength(0);
  });

  it('maps join errors to a typed error', async () => {
    supabaseMock.queue('rpc.join_coach', { error: { message: 'INVALID_COACH_CODE' } });
    const error = await joinCoach(' xx ').catch((e) => e);
    expect(error).toBeInstanceOf(CoachCodeError);
    expect(joinErrorKey(error)).toBe('invalidCoachCode');
    expect(supabaseMock.rpcs[0]).toEqual({ name: 'join_coach', args: { p_code: 'xx' } });

    supabaseMock.queue('rpc.join_coach', { error: { message: 'OWN_COACH_CODE' } });
    expect(joinErrorKey(await joinCoach('ME1234').catch((e) => e))).toBe('ownCoachCode');
    expect(joinErrorKey(new Error('network'))).toBeNull();
  });

  it('reads the student\'s coach and unlinks by student id', async () => {
    supabaseMock.queue('rpc.my_coach', { data: [{ coach_id: 3, coach_name: 'Bia' }] });
    expect(await getMyCoach()).toEqual({ id: 3, name: 'Bia' });

    supabaseMock.queue('rpc.my_coach', { error: { code: 'PGRST202' } });
    expect(await getMyCoach()).toBeNull();

    await unlinkStudent(7);
    const [del] = supabaseMock.calls('coach_students', 'delete');
    expect(filter(del, 'eq', 'student_id')).toEqual(['eq', 'student_id', 7]);
  });
});
