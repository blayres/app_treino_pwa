import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockBackendMode: 'supabase' | 'local' = 'supabase';
jest.mock('../src/services/backendMode', () => ({
  get backendMode() {
    return mockBackendMode;
  },
  hasSupabaseConfig: true,
}));
jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  becomeCoach,
  getCachedCoachCode,
  getCachedMyCoach,
  getCachedStudent,
  getCachedStudents,
  getCoachCode,
  getInviteCoachName,
  getMyCoach,
  getStudent,
  joinCoach,
  listStudents,
  unlinkStudent,
} from '../src/services/coachService';

beforeEach(() => {
  mockBackendMode = 'supabase';
  supabaseMock.reset();
});

const link = (id: number, name: string) => ({ student_id: id, created_at: '2026-10-01', student: { name } });

describe('coach code', () => {
  it('reads the code from the user\'s own profile and keeps it for the first frame', async () => {
    expect(getCachedCoachCode(31)).toBeUndefined();
    supabaseMock.queue('profiles.select', { data: { coach_code: 'ABC123' } });
    expect(await getCoachCode(31)).toBe('ABC123');
    expect(filter(supabaseMock.calls('profiles', 'select')[0], 'eq', 'id')).toEqual(['eq', 'id', 31]);
    expect(getCachedCoachCode(31)).toBe('ABC123');
  });

  it('is null when not a coach or when the read fails', async () => {
    expect(await getCoachCode(32)).toBeNull();
    supabaseMock.queue('profiles.select', { error: { message: 'no column' } });
    expect(await getCoachCode(33)).toBeNull();
  });

  it('becoming a coach goes through the RPC; reset asks for a new code', async () => {
    supabaseMock.queue('rpc.become_coach', { data: 'NEW1' });
    expect(await becomeCoach(true)).toBe('NEW1');
    expect(supabaseMock.rpcs[0]).toEqual({ name: 'become_coach', args: { p_reset: true } });

    supabaseMock.queue('rpc.become_coach', { error: { message: 'denied' } });
    await expect(becomeCoach()).rejects.toEqual({ message: 'denied' });
    expect(supabaseMock.rpcs[1].args).toEqual({ p_reset: false });
  });

  it('coaching needs the online backend', async () => {
    mockBackendMode = 'local';
    await expect(becomeCoach()).rejects.toThrow('Coaching requires the online backend.');
    await expect(listStudents(1)).rejects.toThrow('online backend');
    expect(supabaseMock.queries).toHaveLength(0);
    expect(supabaseMock.rpcs).toHaveLength(0);
  });
});

describe('invites', () => {
  it('shows the coach name for a code, null for an unknown code', async () => {
    supabaseMock.queue('rpc.coach_invite_name', { data: 'Carla' }, { data: null }, { error: { message: 'x' } });
    expect(await getInviteCoachName('ABC')).toBe('Carla');
    expect(supabaseMock.rpcs[0].args).toEqual({ p_code: 'ABC' });
    expect(await getInviteCoachName('ZZZ')).toBeNull();
    await expect(getInviteCoachName('ABC')).rejects.toEqual({ message: 'x' });
  });

  it('joining trims the code and returns the coach name; other errors are rethrown', async () => {
    supabaseMock.queue('rpc.join_coach', { data: 'Carla' }, { error: { message: 'network' } });
    expect(await joinCoach('  ABC  ')).toBe('Carla');
    expect(supabaseMock.rpcs[0].args).toEqual({ p_code: 'ABC' });
    await expect(joinCoach('ABC')).rejects.toEqual({ message: 'network' });
  });
});

describe('my coach', () => {
  it('caches per profile; null before the migration, in local mode, or without a coach', async () => {
    supabaseMock.queue('rpc.my_coach', { data: [{ coach_id: '4', coach_name: 'Carla' }] });
    expect(await getMyCoach(41)).toEqual({ id: 4, name: 'Carla' });
    expect(getCachedMyCoach(41)).toEqual({ id: 4, name: 'Carla' });

    supabaseMock.queue('rpc.my_coach', { error: { message: 'function does not exist' } });
    expect(await getMyCoach()).toBeNull();
    supabaseMock.queue('rpc.my_coach', { data: [] });
    expect(await getMyCoach()).toBeNull();

    mockBackendMode = 'local';
    supabaseMock.reset();
    expect(await getMyCoach()).toBeNull();
    expect(supabaseMock.rpcs).toHaveLength(0);
  });
});

describe('students', () => {
  it('keeps the last list per coach; unlinking removes the student from it', async () => {
    supabaseMock.queue('coach_students.select', { data: [link(1, 'Bia'), link(2, 'Ana')] });
    await listStudents(50);
    expect(getCachedStudents(50)?.map((s) => s.name)).toEqual(['Ana', 'Bia']);
    expect(getCachedStudent(50, 1)?.name).toBe('Bia');

    await unlinkStudent(1);
    expect(getCachedStudents(50)?.map((s) => s.id)).toEqual([2]);
    expect(getCachedStudent(50, 1)).toBeUndefined();
  });

  it('a failed unlink keeps the student in the list', async () => {
    supabaseMock.queue('coach_students.select', { data: [link(1, 'Bia')] });
    await listStudents(51);
    supabaseMock.queue('coach_students.delete', { error: { message: 'denied' } });
    await expect(unlinkStudent(1)).rejects.toEqual({ message: 'denied' });
    expect(getCachedStudents(51)).toHaveLength(1);
  });

  it('a failed activity query fails the list and does not overwrite the cached one', async () => {
    supabaseMock.queue('coach_students.select', { data: [link(1, 'Bia')] });
    await listStudents(52);
    supabaseMock.queue('coach_students.select', { data: [link(1, 'Bia'), link(3, 'Caio')] });
    supabaseMock.queue('workout_sessions.select', { error: { message: 'down' } });
    await expect(listStudents(52)).rejects.toEqual({ message: 'down' });
    expect(getCachedStudents(52)).toHaveLength(1);

    supabaseMock.queue('coach_students.select', { error: { message: 'denied' } });
    await expect(listStudents(52)).rejects.toEqual({ message: 'denied' });
  });

  it('getStudent reads only that coach + student link, null when not linked', async () => {
    supabaseMock.queue('coach_students.select', { data: [link(7, 'Duda')] });
    expect(await getStudent(60, 7)).toMatchObject({ id: 7, name: 'Duda' });
    const [query] = supabaseMock.calls('coach_students', 'select');
    expect(filter(query, 'eq', 'coach_id')).toEqual(['eq', 'coach_id', 60]);
    expect(filter(query, 'eq', 'student_id')).toEqual(['eq', 'student_id', 7]);
    // Activity is read only for that student.
    expect(filter(supabaseMock.calls('workouts', 'select')[0], 'in', 'user_id')).toEqual(['in', 'user_id', [7]]);

    supabaseMock.queue('coach_students.select', { data: [] });
    expect(await getStudent(60, 8)).toBeNull();

    supabaseMock.queue('coach_students.select', { error: { message: 'x' } });
    await expect(getStudent(60, 7)).rejects.toEqual({ message: 'x' });
  });

  it('a student without a name shows a placeholder', async () => {
    supabaseMock.queue('coach_students.select', { data: [{ student_id: 9, created_at: 'x', student: null }] });
    expect((await listStudents(53))[0].name).toBe('—');
  });
});
