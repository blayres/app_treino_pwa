import type { Locale, Translations } from '../i18n/translations';
import { describeStartedDay } from './date';
import { localeTag } from './decimal';

/**
 * Texts for a workout left open for hours: when it started, and the finish
 * button naming the day that will get the check (the start day).
 */
export function forgottenSessionTexts(params: {
  t: Translations;
  locale: Locale;
  startedAt: string;
  workoutTitle: string;
  now?: Date;
}): { message: string; finishLabel: string } {
  const { t, locale, startedAt, workoutTitle } = params;
  const day = describeStartedDay(new Date(startedAt), params.now ?? new Date(), localeTag(locale));
  const when =
    day.when === 'today'
      ? t.forgottenWhenToday
      : day.when === 'yesterday'
        ? t.forgottenWhenYesterday(day.weekdayDate)
        : t.forgottenWhenOn(day.weekdayDate);
  return {
    message: t.forgottenWorkoutMsg(workoutTitle, when, day.time),
    finishLabel: day.when === 'today' ? t.finish : t.finishOnDay(day.shortDate),
  };
}
