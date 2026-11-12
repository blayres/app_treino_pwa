import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Switchable backend: most tests run against Supabase, a few in local (SQLite) mode.
let mockBackendMode: 'supabase' | 'local' = 'supabase';
jest.mock('../src/services/backendMode', () => ({
  get backendMode() {
    return mockBackendMode;
  },
  hasSupabaseConfig: true,
}));
jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
const mockDb = {
  getAllAsync: jest.fn(async (..._args: unknown[]) => [] as unknown[]),
  getFirstAsync: jest.fn(async (..._args: unknown[]) => null as unknown),
  runAsync: jest.fn(async (..._args: unknown[]) => undefined),
};
jest.mock('../src/db', () => ({ getDb: async () => mockDb }));
jest.mock('../src/services/workoutService', () => ({ getWorkoutsByUser: jest.fn() }));
jest.mock('../src/services/defaultWorkoutService', () => ({ applyDefaultProgram: jest.fn() }));

import { supabaseMock } from './helpers/supabaseMock';
import {
  deleteCurrentAccount,
  getCurrentUserEmail,
  getLocalUsers,
  getOrCreateProfile,
  getSessionUser,
  isCurrentUserAdmin,
  loginWithEmail,
  logout,
  markOnboarded,
  sendPasswordReset,
  setLocalCurrentUser,
  signInWithGoogle,
  signUpWithEmail,
  updateCurrentUserName,
} from '../src/services/authService';
import { getWorkoutsByUser } from '../src/services/workoutService';

const workoutsByUser = getWorkoutsByUser as jest.MockedFunction<typeof getWorkoutsByUser>;
const auth = supabaseMock.auth as typeof supabaseMock.auth & { getSession: jest.Mock<any> };
const store = new Map<string, string>();

beforeEach(() => {
  mockBackendMode = 'supabase';
  supabaseMock.reset();
  auth.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  auth.signOut.mockReset().mockResolvedValue({ error: null });
  auth.getSession = jest.fn<any>().mockResolvedValue({ data: { session: null } });
  workoutsByUser.mockReset().mockResolvedValue([]);
  Object.values(mockDb).forEach((fn) => fn.mockClear());
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
  (globalThis as any).window = { location: { origin: 'https://app.test' } };
});

afterEach(() => {
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
});

describe('sign-in / sign-up / password reset', () => {
  it('login forwards the credentials and rethrows the Supabase error', async () => {
    await loginWithEmail('a@x.com', 'pw');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@x.com', password: 'pw' });

    auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    await expect(loginWithEmail('a@x.com', 'bad')).rejects.toEqual({ message: 'Invalid login credentials' });
  });

  it('sign-up sends the confirmation link back to /login of this app and stores the name', async () => {
    await signUpWithEmail('a@x.com', 'pw', 'Ana');
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'a@x.com',
      password: 'pw',
      options: { emailRedirectTo: 'https://app.test/login', data: { name: 'Ana' } },
    });
  });

  it('sign-up without a name sends no metadata, and errors are rethrown', async () => {
    auth.signUp.mockResolvedValueOnce({ error: { message: 'User already registered' } });
    await expect(signUpWithEmail('a@x.com', 'pw')).rejects.toEqual({ message: 'User already registered' });
    expect((auth.signUp.mock.calls[0] as any[])[0].options.data).toBeUndefined();
  });

  it('Google sign-in returns to the app root', async () => {
    await signInWithGoogle();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.test/' },
    });
    auth.signInWithOAuth.mockResolvedValueOnce({ error: { message: 'popup closed' } });
    await expect(signInWithGoogle()).rejects.toEqual({ message: 'popup closed' });
  });

  it('password reset link points to /login', async () => {
    await sendPasswordReset('a@x.com');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('a@x.com', { redirectTo: 'https://app.test/login' });
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'rate limit' } });
    await expect(sendPasswordReset('a@x.com')).rejects.toEqual({ message: 'rate limit' });
  });
});

describe('logout', () => {
  it('signs out of Supabase and surfaces errors', async () => {
    await logout();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    auth.signOut.mockResolvedValueOnce({ error: { message: 'network' } });
    await expect(logout()).rejects.toEqual({ message: 'network' });
  });

  it('local mode forgets the remembered user', async () => {
    mockBackendMode = 'local';
    store.set('lastUserId', '4');
    await logout();
    expect(store.has('lastUserId')).toBe(false);
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe('getCurrentUserEmail', () => {
  it('answers from the stored session without a network request', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'a@x.com' } } } });
    expect(await getCurrentUserEmail()).toBe('a@x.com');
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it('falls back to getUser, and throws its error', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: { email: 'b@x.com' } }, error: null });
    expect(await getCurrentUserEmail()).toBe('b@x.com');

    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'expired' } });
    await expect(getCurrentUserEmail()).rejects.toEqual({ message: 'expired' });
  });

  it('is empty in local mode', async () => {
    mockBackendMode = 'local';
    expect(await getCurrentUserEmail()).toBe('');
  });
});

describe('getSessionUser', () => {
  it('returns null when signed out (missing session is not an error)', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth session missing!' } });
    expect(await getSessionUser()).toBeNull();
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await getSessionUser()).toBeNull();
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('rethrows other auth errors', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'boom' } });
    await expect(getSessionUser()).rejects.toEqual({ message: 'boom' });
  });

  it('loads the profile of the signed-in auth user only', async () => {
    auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-7', email: 'a@x.com', user_metadata: {} } },
      error: null,
    });
    supabaseMock.queue('profiles.select', { data: { id: 7, name: 'Ana', onboarded_at: '2026-01-01' } });
    expect(await getSessionUser()).toEqual({ id: 7, name: 'Ana', needsOnboarding: false });
    expect(supabaseMock.calls('profiles', 'select')[0].chain).toContainEqual(['eq', 'auth_id', 'auth-7']);
  });

  it('local mode reads the remembered user, or null', async () => {
    mockBackendMode = 'local';
    expect(await getSessionUser()).toBeNull();
    expect(mockDb.getFirstAsync).not.toHaveBeenCalled();

    store.set('lastUserId', '4');
    mockDb.getFirstAsync.mockResolvedValueOnce({ id: 4, name: 'Lu' });
    expect(await getSessionUser()).toEqual({ id: 4, name: 'Lu' });
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'), 4);
  });
});

describe('getOrCreateProfile edge cases', () => {
  it('stays in onboarding when the workout lookup fails', async () => {
    supabaseMock.queue('profiles.select', { data: { id: 3, name: 'Ana', onboarded_at: null } });
    workoutsByUser.mockRejectedValueOnce(new Error('offline'));
    expect(await getOrCreateProfile('auth-1', undefined, {})).toMatchObject({ needsOnboarding: true });
    expect(supabaseMock.calls('profiles', 'update')).toHaveLength(0);
  });

  it('falls back to "Aluna" when there is neither a name nor an e-mail', async () => {
    supabaseMock.queue('profiles.select', { data: null });
    supabaseMock.queue('profiles.insert', { data: { id: 1, name: 'Aluna' } });
    await getOrCreateProfile('auth-1', undefined, {});
    expect(supabaseMock.calls('profiles', 'insert')[0].payload).toEqual({ auth_id: 'auth-1', name: 'Aluna' });
  });

  it('legacy mode still logs in when seeding the default program fails', async () => {
    const { applyDefaultProgram } = jest.requireMock('../src/services/defaultWorkoutService') as {
      applyDefaultProgram: jest.Mock<any>;
    };
    applyDefaultProgram.mockRejectedValueOnce(new Error('seed failed'));
    supabaseMock.queue('profiles.select', { error: { code: '42703' } }, { data: null });
    supabaseMock.queue('profiles.insert', { data: { id: 9, name: 'Bia' } });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await getOrCreateProfile('auth-2', 'bia@x.com', {})).toEqual({ id: 9, name: 'Bia', needsOnboarding: false });
    warn.mockRestore();
  });
});

describe('isCurrentUserAdmin edge cases', () => {
  it('false when signed out or when the profile cannot be read; rethrows other auth errors', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth session missing!' } });
    expect(await isCurrentUserAdmin()).toBe(false);

    auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    supabaseMock.queue('profiles.select', { error: { message: 'denied' } });
    expect(await isCurrentUserAdmin()).toBe(false);

    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'boom' } });
    await expect(isCurrentUserAdmin()).rejects.toEqual({ message: 'boom' });
  });

  it('local mode (single device owner) is admin', async () => {
    mockBackendMode = 'local';
    expect(await isCurrentUserAdmin()).toBe(true);
  });
});

describe('updateCurrentUserName edge cases', () => {
  it('refuses when there is no session, without touching profiles', async () => {
    await expect(updateCurrentUserName(3, 'Ana')).rejects.toThrow('Auth session missing');
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('rethrows the update error', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    supabaseMock.queue('profiles.update', { error: { message: 'denied' } });
    await expect(updateCurrentUserName(3, 'Ana')).rejects.toEqual({ message: 'denied' });
  });

  it('local mode updates only that user row', async () => {
    mockBackendMode = 'local';
    expect(await updateCurrentUserName(5, ' Lu ')).toEqual({ id: 5, name: 'Lu' });
    expect(mockDb.runAsync).toHaveBeenCalledWith('UPDATE users SET name = ? WHERE id = ?;', 'Lu', 5);
  });
});

describe('markOnboarded', () => {
  it('only stamps the given profile and does nothing in local mode', async () => {
    await markOnboarded(8);
    expect(supabaseMock.calls('profiles', 'update')[0].chain).toEqual([['eq', 'id', 8]]);

    mockBackendMode = 'local';
    supabaseMock.reset();
    await markOnboarded(8);
    expect(supabaseMock.queries).toHaveLength(0);
  });
});

describe('local mode accounts', () => {
  beforeEach(() => {
    mockBackendMode = 'local';
  });

  it('lists local users by name', async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([{ id: 1, name: 'A' }]);
    expect(await getLocalUsers()).toEqual([{ id: 1, name: 'A' }]);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('ORDER BY name'));
  });

  it('remembers the chosen user only when it exists', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    expect(await setLocalCurrentUser(9)).toBeNull();
    expect(store.has('lastUserId')).toBe(false);

    mockDb.getFirstAsync.mockResolvedValueOnce({ id: 2, name: 'B' });
    expect(await setLocalCurrentUser(2)).toEqual({ id: 2, name: 'B' });
    expect(store.get('lastUserId')).toBe('2');
  });

  it('account deletion removes only the remembered user data, then forgets them', async () => {
    store.set('lastUserId', '4');
    await deleteCurrentAccount();
    const calls = mockDb.runAsync.mock.calls;
    expect(calls).toHaveLength(6);
    // Every statement is scoped to the current user id.
    for (const call of calls) {
      expect(call[0]).toMatch(/WHERE (user_id|id) = \?|user_id = \?/);
      expect(call[1]).toBe(4);
    }
    expect(calls.map((c) => String(c[0]).split(' ')[2])).toEqual([
      'workout_exercises',
      'workout_sessions',
      'attendance',
      'exercise_loads',
      'workouts',
      'users',
    ]);
    expect(store.has('lastUserId')).toBe(false);
  });

  it('account deletion without a remembered user deletes nothing', async () => {
    await deleteCurrentAccount();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });
});
