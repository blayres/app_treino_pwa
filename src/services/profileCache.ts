/**
 * Last signed-in profile per auth account, kept on the device so the next app
 * start can query the active session and Home data in parallel with the
 * profile lookup (instead of waiting for it). Only ids/names: RLS still decides
 * what each query may return, and the profile lookup always confirms the id.
 */
type CachedProfile = { id: number; name: string };

const key = (authId: string) => `profileCache:v1:${authId}`;

export function readCachedProfile(authId: string): CachedProfile | null {
  try {
    const raw = localStorage.getItem(key(authId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.id !== 'number' || typeof parsed?.name !== 'string') return null;
    return { id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}

export function rememberProfile(authId: string, profile: CachedProfile) {
  try {
    localStorage.setItem(key(authId), JSON.stringify({ id: profile.id, name: profile.name }));
  } catch { }
}

export function forgetCachedProfiles() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('profileCache:'))
      .forEach((k) => localStorage.removeItem(k));
  } catch { }
}
