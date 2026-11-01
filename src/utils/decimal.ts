/**
 * Decimal numbers (loads in kg) typed and shown in the user's language:
 * "43,5" in pt/es/fr, "43.5" in en. Users may type either separator; the input
 * is normalised to the locale's one and parsed with either.
 */
import type { Locale } from '../i18n/translations';

const LOCALE_TAGS: Record<Locale, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };

export function decimalSeparator(locale: Locale): ',' | '.' {
  return locale === 'en' ? '.' : ',';
}

/**
 * Cleans what the user typed into a load field: digits plus ONE separator
 * (shown as the locale's), at most 4 integer digits and 2 decimals.
 * "43.5" → "43,5" (pt); "4,3,5" → "4,35"; "12a" → "12".
 */
export function sanitizeDecimalInput(text: string, locale: Locale): string {
  const sep = decimalSeparator(locale);
  let seenSeparator = false;
  let integer = '';
  let fraction = '';
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      if (seenSeparator) {
        if (fraction.length < 2) fraction += char;
      } else if (integer.length < 4) {
        integer += char;
      }
    } else if ((char === ',' || char === '.') && !seenSeparator) {
      seenSeparator = true;
    }
  }
  if (!seenSeparator) return integer;
  return `${integer || '0'}${sep}${fraction}`;
}

/** "43,5" / "43.5" / "43," → 43.5 / 43.5 / 43. Empty or invalid → null. */
export function parseDecimal(text: string): number | null {
  const normalised = text.trim().replace(',', '.');
  if (!normalised || normalised === '.') return null;
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

/** 43.5 → "43,5" (pt) / "43.5" (en); 40 → "40". No thousands grouping. */
export function formatDecimal(value: number, locale: Locale, maxFractionDigits = 2): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  }).format(value);
}

/** 43.5 → "43,5 kg". */
export function formatKg(value: number, locale: Locale): string {
  return `${formatDecimal(value, locale, 1)} kg`;
}

/** Signed change: +2,5 kg / −1 kg / 0 kg. */
export function formatKgDelta(value: number, locale: Locale): string {
  const abs = formatDecimal(Math.abs(value), locale, 1);
  if (value > 0) return `+${abs} kg`;
  if (value < 0) return `−${abs} kg`;
  return `${abs} kg`;
}

export function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale];
}
