/** Production URL (used when there is no browser location, e.g. native). */
export const PRODUCTION_ORIGIN = 'https://app-treino-pwa-pi.vercel.app';

/** Origin of the running web app (links sent by e-mail / invites). */
export function appOrigin(): string {
  return (typeof window !== 'undefined' && window.location?.origin) || PRODUCTION_ORIGIN;
}
