import { getDb } from '../db';
import { backendMode } from './backendMode';
import { ensureSupabaseEnabled, supabase } from './supabaseClient';
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
      : undefined;

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

export async function getSessionUser(): Promise<User | null> {
  if (backendMode === 'supabase') {
    ensureSupabaseEnabled();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Sem sessão ativa é esperado antes do primeiro login.
      if (error.message?.includes(AUTH_SESSION_MISSING)) return null;
      throw error;
    }
    if (!data.user) return null;

    const profile = await supabase
      .from('profiles')
      .select('id, name')
      .eq('auth_id', data.user.id)
      .maybeSingle();

    if (!profile.error && profile.data) {
      return {
        id: Number(profile.data.id),
        name: String(profile.data.name),
      };
    }

    const authName = data.user.user_metadata?.name || data.user.email || 'Aluna';
    return { id: 0, name: String(authName) };
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
