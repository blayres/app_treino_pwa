import { getDb } from '../db';
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import { seedDefaultWorkoutsForUser } from './defaultWorkoutService';
import type { User } from './types';

const LAST_USER_KEY = 'lastUserId';
const AUTH_SESSION_MISSING = 'Auth session missing';

export async function getLocalUsers(): Promise<User[]> {
  const db = await getDb();
  return db.getAllAsync<User>(`SELECT * FROM users ORDER BY name ASC;`);
}

export async function loginWithEmail(email: string, password: string) {
  ensureSupabaseEnabled();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email: string, password: string, name?: string) {
  ensureSupabaseEnabled();

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/login`
      : 'https://app-treino-pwa-pi.vercel.app/login';

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: name ? { name } : undefined,
    },
  });

  if (error) throw error;
}

export async function signInWithGoogle() {
  ensureSupabaseEnabled();
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  ensureSupabaseEnabled();
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/login`
      : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function logout() {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return;
  }

  localStorage.removeItem(LAST_USER_KEY);
}

export async function updateCurrentUserName(userId: number, name: string): Promise<User> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Name is required.');

  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user) throw new Error(AUTH_SESSION_MISSING);

    const { data, error } = await supabase
      .from('profiles')
      .update({ name: trimmedName })
      .eq('id', userId)
      .eq('auth_id', authData.user.id)
      .select('id, name')
      .single();
    if (error) throw error;
    return { id: Number(data.id), name: String(data.name) };
  }

  const db = await getDb();
  await db.runAsync('UPDATE users SET name = ? WHERE id = ?;', trimmedName, userId);
  return { id: userId, name: trimmedName };
}

export async function deleteCurrentAccount(): Promise<void> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { error } = await supabase.rpc('delete_own_account');
    if (error) throw error;
    return;
  }

  const db = await getDb();
  const lastUserId = Number(localStorage.getItem(LAST_USER_KEY));
  if (!lastUserId) return;
  await db.runAsync('DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = ?);', lastUserId);
  await db.runAsync('DELETE FROM workout_sessions WHERE user_id = ?;', lastUserId);
  await db.runAsync('DELETE FROM attendance WHERE user_id = ?;', lastUserId);
  await db.runAsync('DELETE FROM exercise_loads WHERE user_id = ?;', lastUserId);
  await db.runAsync('DELETE FROM workouts WHERE user_id = ?;', lastUserId);
  await db.runAsync('DELETE FROM users WHERE id = ?;', lastUserId);
  localStorage.removeItem(LAST_USER_KEY);
}

export async function getSessionUser(): Promise<User | null> {
  if (backendMode === 'supabase') {
    try {
      ensureSupabaseEnabled();
    } catch {
      console.warn('Supabase não disponível, retornando null');
      return null;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (error.message?.includes(AUTH_SESSION_MISSING)) return null;
      throw error;
    }
    if (!data.user) return null;
    return getOrCreateProfile(data.user.id, data.user.email, data.user.user_metadata);
  }

  const db = await getDb();
  const lastUserId = localStorage.getItem(LAST_USER_KEY);
  if (!lastUserId) return null;
  const user = await db.getFirstAsync<User>(
    `SELECT * FROM users WHERE id = ?;`,
    Number(lastUserId),
  );
  return user ?? null;
}

/**
 * Looks up the profile row for a given Supabase auth user.
 * Creates it (and seeds default workouts) if it doesn't exist yet.
 * Accepts the auth user data directly so callers don't need to call
 * supabase.auth.getUser() again — avoiding lock contention.
 */
export async function getOrCreateProfile(
  authId: string,
  email: string | undefined,
  userMetadata: Record<string, any>,
): Promise<User | null> {
  ensureSupabaseEnabled();

  const profile = await supabase
    .from('profiles')
    .select('id, name')
    .eq('auth_id', authId)
    .maybeSingle();

  if (!profile.error && profile.data) {
    return {
      id: Number(profile.data.id),
      name: String(profile.data.name),
    };
  }

  // Profile doesn't exist yet — create it automatically
  const authName = userMetadata?.name || email?.split('@')[0] || 'Aluna';
  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({ auth_id: authId, name: authName })
    .select('id, name')
    .single();

  if (!insertError && newProfile) {
    try {
      await seedDefaultWorkoutsForUser(Number(newProfile.id));
    } catch (seedErr) {
      console.warn('Falha ao criar treino padrão:', seedErr);
    }
    return {
      id: Number(newProfile.id),
      name: String(newProfile.name),
    };
  }

  console.warn('Não foi possível criar perfil:', insertError?.message);
  return null;
}

export async function setLocalCurrentUser(userId: number): Promise<User | null> {
  const db = await getDb();
  const user = await db.getFirstAsync<User>(
    `SELECT * FROM users WHERE id = ?;`,
    userId,
  );
  if (user) {
    localStorage.setItem(LAST_USER_KEY, String(user.id));
  }
  return user ?? null;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (backendMode !== 'supabase') return true;

  ensureSupabaseEnabled();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error) {
    if (error.message?.includes(AUTH_SESSION_MISSING)) return false;
    throw error;
  }
  if (!userData.user) return false;

  const role = userData.user.user_metadata?.role;
  if (role === 'admin') return true;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', userData.user.id)
    .maybeSingle();

  if (profileError) return false;
  return profile?.role === 'admin';
}
