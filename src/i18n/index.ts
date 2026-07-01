import { create } from 'zustand';
import type { Locale, Translations } from './translations';
import { locales } from './translations';

// Detect browser language on first load
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored && stored in locales) return stored;
    const browser = navigator.language.slice(0, 2) as Locale;
    if (browser in locales) return browser;
  } catch {}
  return 'pt';
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
