/**
 * Invite links: /convite/ABC234. The code is kept until the user is signed in
 * (they may need to log in or create an account first), then
 * PendingInviteHost offers to join that coach.
 */
const STORAGE_KEY = 'pendingCoachInvite';
const INVITE_PATH = /^\/convite\/([A-Za-z0-9]{4,12})\/?$/;

/** Code from an invite path, uppercased; null for any other path. */
export function inviteCodeFromPath(pathname: string): string | null {
  const match = INVITE_PATH.exec(pathname);
  return match ? match[1].toUpperCase() : null;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Call once at boot, before navigation reads the URL: remembers an invite link's code. */
export function captureInviteFromUrl(): void {
  if (typeof window === 'undefined') return;
  const code = inviteCodeFromPath(window.location?.pathname ?? '');
  if (!code) return;
  try {
    storage()?.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode: the invite can still be entered by hand in Settings.
  }
  // /convite/... is not a screen: continue at the app root (login or home).
  window.history?.replaceState?.(null, '', '/');
}

export function peekPendingInvite(): string | null {
  try {
    return storage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
