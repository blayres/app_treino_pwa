/**
 * Exercise texts in the user's language. The catalogue is written in Portuguese
 * (exercises.name / exercises.tip); translations live in name_i18n / tip_i18n
 * ({ en, es, fr }, see supabase/migration_exercise_translations.sql). Anything
 * without a translation — the user's own exercises, coach notes — shows as typed.
 */
import type { Locale } from '../i18n/translations';
import { normalizeSearch } from './text';

/** Texts by language; Portuguese is the base column, so it never appears here. */
export type I18nText = Partial<Record<Exclude<Locale, 'pt'>, string>> | null | undefined;

function pick(base: string, translations: I18nText, locale: Locale): string {
  if (locale === 'pt' || !translations) return base;
  const value = translations[locale];
  return typeof value === 'string' && value.trim() ? value : base;
}

export function exerciseName(exercise: { name: string; name_i18n?: I18nText }, locale: Locale): string {
  return pick(exercise.name, exercise.name_i18n, locale);
}

export function exerciseTip(exercise: { tip: string | null; tip_i18n?: I18nText }, locale: Locale): string | null {
  return exercise.tip ? pick(exercise.tip, exercise.tip_i18n, locale) : null;
}

/** The name in every language it has (Portuguese first): search matches any of them. */
export function exerciseNames(exercise: { name: string; name_i18n?: I18nText }): string[] {
  return [exercise.name, ...Object.values(exercise.name_i18n ?? {})].filter(
    (value): value is string => typeof value === 'string' && !!value.trim(),
  );
}

/**
 * Muscle stored as Portuguese text ("peito", "gluteo medio") → label in the
 * user's language from `labels` (translations `muscles`); unknown ones are shown
 * capitalised as stored.
 */
export function muscleLabel(muscle: string | null | undefined, labels: Record<string, string>): string | null {
  if (!muscle?.trim()) return null;
  const label = labels[normalizeSearch(muscle)];
  if (label) return label;
  const text = muscle.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
