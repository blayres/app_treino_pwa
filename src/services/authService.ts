import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
import { applyDefaultProgram } from './defaultWorkoutService';
import { getWorkoutsByUser } from './workoutService';
import type { User } from './types';

// Local SQLite (sql.js) is only for local mode: load it on demand so it stays
// out of the main bundle in production.
async function getDb() {
  const { getDb: open } = await import('../db');
  return open();
}

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

export async function getCurrentUserEmail(): Promise<string> {
  if (backendMode !== 'supabase') return '';

  ensureSupabaseEnabled();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.email ?? '';
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
    // The auth user no longer exists; drop the stored session locally so a
    // reload doesn't try to restore it (a server-side signOut would fail).
    await supabase.auth.signOut({ scope: 'local' });
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

// Postgres "undefined_column": migration_onboarding.sql not applied yet.
const UNDEFINED_COLUMN = '42703';

/**
 * Looks up the profile row for a given Supabase auth user, creating it if it
 * doesn't exist yet. `needsOnboarding` is true for accounts that haven't chosen
 * how to start (default program / import / manual) — see OnboardingScreen.
 * Accepts the auth user data directly so callers don't need to call
 * supabase.auth.getUser() again — avoiding lock contention.
 */
export async function getOrCreateProfile(
  authId: string,
  email: string | undefined,
  userMetadata: Record<string, any>,
): Promise<(User & { needsOnboarding: boolean }) | null> {
  ensureSupabaseEnabled();

  let hasOnboardingColumn = true;
  let profile = await supabase
    .from('profiles')
    .select('id, name, onboarded_at')
    .eq('auth_id', authId)
    .maybeSingle();

  if (profile.error?.code === UNDEFINED_COLUMN) {
    hasOnboardingColumn = false;
    profile = await supabase.from('profiles').select('id, name').eq('auth_id', authId).maybeSingle() as typeof profile;
  }

  if (!profile.error && profile.data) {
    const user = { id: Number(profile.data.id), name: String(profile.data.name) };
    let needsOnboarding = hasOnboardingColumn && profile.data.onboarded_at == null;

    // Accounts created before onboarding existed already have a program.
    if (needsOnboarding) {
      try {
        const workouts = await getWorkoutsByUser(user.id);
        if (workouts.length > 0) {
          needsOnboarding = false;
          void markOnboarded(user.id).catch(() => {});
        }
      } catch {
        // Keep needsOnboarding = true; the onboarding screen handles errors.
      }
    }

    return { ...user, needsOnboarding };
  }

  // Profile doesn't exist yet — create it automatically
  const authName = userMetadata?.name || email?.split('@')[0] || 'Aluna';
  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({ auth_id: authId, name: authName })
    .select('id, name')
    .single();

  if (!insertError && newProfile) {
    const user = { id: Number(newProfile.id), name: String(newProfile.name) };

    if (!hasOnboardingColumn) {
      // Legacy behaviour until the migration is applied: seed the default program.
      try {
        await applyDefaultProgram(user.id);
      } catch (seedErr) {
        console.warn('Falha ao criar treino padrão:', seedErr);
      }
      return { ...user, needsOnboarding: false };
    }

    return { ...user, needsOnboarding: true };
  }

  console.warn('Não foi possível criar perfil:', insertError?.message);
  return null;
}

/** Marks the profile as onboarded so /onboarding is not shown again. */
export async function markOnboarded(profileId: number): Promise<void> {
  if (backendMode !== 'supabase') return;
  ensureSupabaseEnabled();
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', profileId);
  if (error && error.code !== UNDEFINED_COLUMN) throw error;
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

  // Only profiles.role decides (users can't change it — see migration_security.sql).
  // Never trust user_metadata: any user can edit their own metadata.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', userData.user.id)
    .maybeSingle();

  if (profileError) return false;
  return profile?.role === 'admin';
}
