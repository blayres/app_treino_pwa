import { describe, expect, it } from '@jest/globals';
import { exerciseName, exerciseNames, exerciseTip, muscleLabel } from '../src/utils/exerciseText';
import { locales } from '../src/i18n/translations';

const prancha = {
  name: 'Prancha',
  name_i18n: { en: 'Plank', es: 'Plancha', fr: 'Gainage (planche)' },
  tip: 'Quadril neutro.',
  tip_i18n: { en: 'Neutral hips.', fr: 'Bassin neutre.' },
};

describe('exerciseName / exerciseTip', () => {
  it('shows the user language, Portuguese for pt', () => {
    expect(exerciseName(prancha, 'fr')).toBe('Gainage (planche)');
    expect(exerciseName(prancha, 'en')).toBe('Plank');
    expect(exerciseName(prancha, 'pt')).toBe('Prancha');
    expect(exerciseTip(prancha, 'fr')).toBe('Bassin neutre.');
  });

  it('falls back to Portuguese when a translation is missing or empty', () => {
    expect(exerciseTip(prancha, 'es')).toBe('Quadril neutro.');
    expect(exerciseName({ name: 'Remada cavalinho' }, 'fr')).toBe('Remada cavalinho'); // user's own exercise
    expect(exerciseName({ name: 'Prancha', name_i18n: { fr: '  ' } }, 'fr')).toBe('Prancha');
    expect(exerciseName({ name: 'Prancha', name_i18n: null }, 'en')).toBe('Prancha');
  });

  it('no tip stays no tip (a translation alone is never shown)', () => {
    expect(exerciseTip({ tip: null, tip_i18n: { fr: 'x' } }, 'fr')).toBeNull();
  });

  it('lists the name in every language for search', () => {
    expect(exerciseNames(prancha)).toEqual(['Prancha', 'Plank', 'Plancha', 'Gainage (planche)']);
    expect(exerciseNames({ name: 'Remada cavalinho' })).toEqual(['Remada cavalinho']);
  });
});

describe('muscleLabel', () => {
  it('translates the stored Portuguese muscle, ignoring accents and case', () => {
    expect(muscleLabel('peito', locales.fr.muscles)).toBe('Pectoraux');
    expect(muscleLabel('Glúteo Médio', locales.en.muscles)).toBe('Gluteus medius');
    expect(muscleLabel('posterior', locales.pt.muscles)).toBe('Posterior de coxa');
  });

  it('shows unknown muscles capitalised as stored, and nothing for empty', () => {
    expect(muscleLabel('antebraço', locales.fr.muscles)).toBe('Antebraço');
    expect(muscleLabel('', locales.fr.muscles)).toBeNull();
    expect(muscleLabel(null, locales.fr.muscles)).toBeNull();
  });

  it('every language labels the same muscles', () => {
    const keys = Object.keys(locales.pt.muscles).sort();
    for (const locale of ['en', 'es', 'fr'] as const) expect(Object.keys(locales[locale].muscles).sort()).toEqual(keys);
  });
});
