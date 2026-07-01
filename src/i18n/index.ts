import { create } from 'zustand';
import type { Locale, Translations } from './translations';
import { locales } from './translations';

function isLocale(value: string | null | undefined): value is Locale {
  return typeof value === 'string' && value in locales;
}

// Detect browser language on first load when no choice has been saved yet.
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem('locale');
    if (isLocale(stored)) return stored;

    const browserLanguage = navigator.language?.toLowerCase();
    const browserLocale = browserLanguage?.split('-')[0];
    if (isLocale(browserLocale)) return browserLocale;
  } catch {}

  return 'en';
}

type I18nState = {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
};

export const useI18n = create<I18nState>((set) => {
  const initial = detectLocale();
  return {
    locale: initial,
    t: locales[initial],
    setLocale: (locale: Locale) => {
      try { localStorage.setItem('locale', locale); } catch {}
      set({ locale, t: locales[locale] });
    },
  };
});

// Convenience: get translations without subscribing to locale changes
// (useful in non-component code)
export function getT(): Translations {
  return useI18n.getState().t;
}

export type { Locale, Translations };
