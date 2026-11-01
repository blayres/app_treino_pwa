import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));
jest.mock('../src/db', () => ({ getDb: jest.fn() }));
jest.mock('../src/services/workoutService', () => ({ getWorkoutsByUser: jest.fn() }));
jest.mock('../src/services/defaultWorkoutService', () => ({ applyDefaultProgram: jest.fn() }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  deleteCurrentAccount,
  getOrCreateProfile,
  isCurrentUserAdmin,
  markOnboarded,
  updateCurrentUserName,
} from '../src/services/authService';
import { getWorkoutsByUser } from '../src/services/workoutService';
import { applyDefaultProgram } from '../src/services/defaultWorkoutService';

const workoutsByUser = getWorkoutsByUser as jest.MockedFunction<typeof getWorkoutsByUser>;
const defaultProgram = applyDefaultProgram as jest.MockedFunction<typeof applyDefaultProgram>;
const UNDEFINED_COLUMN = { code: '42703', message: 'column profiles.onboarded_at does not exist' };

beforeEach(() => {
  supabaseMock.reset();
  workoutsByUser.mockReset().mockResolvedValue([]);
  defaultProgram.mockReset().mockResolvedValue(undefined);
});

describe('getOrCreateProfile', () => {
  it('existing onboarded profile → goes straight to the app', async () => {
    supabaseMock.queue('profiles.select', { data: { id: 3, name: 'Ana', onboarded_at: '2026-10-01' } });
    expect(await getOrCreateProfile('auth-1', 'a@x.com', {})).toEqual({ id: 3, name: 'Ana', needsOnboarding: false });
    expect(filter(supabaseMock.calls('profiles', 'select')[0], 'eq', 'auth_id')).toEqual(['eq', 'auth_id', 'auth-1']);
  });

  it('existing profile that never onboarded and has no workouts → onboarding', async () => {
    supabaseMock.queue('profiles.select', { data: { id: 3, name: 'Ana', onboarded_at: null } });
    expect(await getOrCreateProfile('auth-1', 'a@x.com', {})).toMatchObject({ needsOnboarding: true });
  });

  it('older account that already has a program is marked onboarded instead', async () => {
    supabaseMock.queue('profiles.select', { data: { id: 3, name: 'Ana', onboarded_at: null } });
    workoutsByUser.mockResolvedValue([{ id: 1 } as any]);

    expect(await getOrCreateProfile('auth-1', 'a@x.com', {})).toMatchObject({ needsOnboarding: false });
    await Promise.resolve();
    const [update] = supabaseMock.calls('profiles', 'update');
    expect(update.payload).toMatchObject({ onboarded_at: expect.any(String) });
    expect(filter(update, 'eq', 'id')).toEqual(['eq', 'id', 3]);
  });

  it('new account → creates the profile and sends it to onboarding (no default program)', async () => {
    supabaseMock.queue('profiles.select', { data: null });
    supabaseMock.queue('profiles.insert', { data: { id: 9, name: 'Bia' } });

    expect(await getOrCreateProfile('auth-2', 'bia@x.com', { name: 'Bia' })).toEqual({
      id: 9,
      name: 'Bia',
      needsOnboarding: true,
    });
    expect(supabaseMock.calls('profiles', 'insert')[0].payload).toEqual({ auth_id: 'auth-2', name: 'Bia' });
    expect(defaultProgram).not.toHaveBeenCalled();
  });

  it('never sends a role on insert (users cannot make themselves admin)', async () => {
    supabaseMock.queue('profiles.select', { data: null });
    supabaseMock.queue('profiles.insert', { data: { id: 9, name: 'x' } });
    await getOrCreateProfile('auth-2', 'x@x.com', { role: 'admin', name: 'x' });
    expect(supabaseMock.calls('profiles', 'insert')[0].payload).not.toHaveProperty('role');
  });

  it('uses the e-mail prefix when there is no name', async () => {
    supabaseMock.queue('profiles.select', { data: null });
    supabaseMock.queue('profiles.insert', { data: { id: 9, name: 'carla' } });
    await getOrCreateProfile('auth-3', 'carla@x.com', {});
    expect(supabaseMock.calls('profiles', 'insert')[0].payload).toMatchObject({ name: 'carla' });
  });

  it('before the onboarding migration: legacy behaviour (default program, no onboarding)', async () => {
    supabaseMock.queue('profiles.select', { error: UNDEFINED_COLUMN }, { data: null });
    supabaseMock.queue('profiles.insert', { data: { id: 9, name: 'Bia' } });

    expect(await getOrCreateProfile('auth-2', 'bia@x.com', {})).toMatchObject({ needsOnboarding: false });
    expect(supabaseMock.calls('profiles', 'select')[1].payload).toBe('id, name');
    expect(defaultProgram).toHaveBeenCalledWith(9);
  });

  it('returns null when the profile cannot be created', async () => {
    supabaseMock.queue('profiles.select', { data: null });
    supabaseMock.queue('profiles.insert', { error: { message: 'denied' } });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await getOrCreateProfile('auth-2', 'x@x.com', {})).toBeNull();
    warn.mockRestore();
  });
});

describe('markOnboarded', () => {
  it('stamps onboarded_at and tolerates the column not existing yet', async () => {
    await markOnboarded(3);
    expect(supabaseMock.calls('profiles', 'update')[0].payload).toMatchObject({ onboarded_at: expect.any(String) });

    supabaseMock.queue('profiles.update', { error: UNDEFINED_COLUMN });
    await expect(markOnboarded(3)).resolves.toBeUndefined();

    supabaseMock.queue('profiles.update', { error: { code: '42501', message: 'denied' } });
    await expect(markOnboarded(3)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('isCurrentUserAdmin', () => {
  it('ignores user_metadata.role (editable by the user) and trusts only profiles.role', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', user_metadata: { role: 'admin' } } }, error: null });
    supabaseMock.queue('profiles.select', { data: { role: 'student' } });
    expect(await isCurrentUserAdmin()).toBe(false);
  });

  it('is true for an admin profile and false when signed out', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', user_metadata: {} } }, error: null });
    supabaseMock.queue('profiles.select', { data: { role: 'admin' } });
    expect(await isCurrentUserAdmin()).toBe(true);

    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await isCurrentUserAdmin()).toBe(false);
  });
});

describe('deleteCurrentAccount', () => {
  it('deletes through the RPC, then drops the local session', async () => {
    await deleteCurrentAccount();
    expect(supabaseMock.rpcs).toEqual([{ name: 'delete_own_account', args: undefined }]);
    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('keeps the session when the deletion fails', async () => {
    supabaseMock.queue('rpc.delete_own_account', { error: { message: 'boom' } });
    await expect(deleteCurrentAccount()).rejects.toEqual({ message: 'boom' });
    expect(supabaseMock.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('updateCurrentUserName', () => {
  it('trims the name and only updates the signed-in user row', async () => {
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    supabaseMock.queue('profiles.update', { data: { id: 3, name: 'Ana Paula' } });

    expect(await updateCurrentUserName(3, '  Ana Paula ')).toEqual({ id: 3, name: 'Ana Paula' });
    const [update] = supabaseMock.calls('profiles', 'update');
    expect(update.payload).toEqual({ name: 'Ana Paula' });
    expect(filter(update, 'eq', 'auth_id')).toEqual(['eq', 'auth_id', 'u1']);
  });

  it('rejects an empty name without calling the database', async () => {
    await expect(updateCurrentUserName(3, '   ')).rejects.toThrow('Name is required.');
    expect(supabaseMock.queries).toHaveLength(0);
  });
});
