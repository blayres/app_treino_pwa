import { describe, expect, it } from '@jest/globals';
import { en, fr, pt } from '../src/i18n/translations';
import { forgottenSessionTexts } from '../src/utils/forgottenSession';

const now = new Date(2026, 10, 10, 6, 38); // Tue 10/11, 06:38 local
const iso = (d: number, h: number, m: number) => new Date(2026, 10, d, h, m).toISOString();

describe('forgottenSessionTexts', () => {
  it('names yesterday and puts the start day on the finish button', () => {
    const texts = forgottenSessionTexts({ t: pt, locale: 'pt', startedAt: iso(9, 18, 40), workoutTitle: 'Superiores', now });
    expect(texts.message).toMatch(/^Seu treino "Superiores" começou ontem \(seg.*09\/11\) às 18:40\.$/);
    expect(texts.finishLabel).toBe('Finalizar no dia 09/11');
  });

  it('older workouts show the weekday and date', () => {
    const texts = forgottenSessionTexts({ t: en, locale: 'en', startedAt: iso(7, 18, 0), workoutTitle: 'Legs', now });
    expect(texts.message).toMatch(/^Your "Legs" workout started on Sat.*11\/7 at 06:00 PM\.$/);
    expect(texts.finishLabel).toBe('Finish on 11/7');
  });

  it('same day keeps the plain "Finalizar" button', () => {
    const texts = forgottenSessionTexts({ t: pt, locale: 'pt', startedAt: iso(10, 1, 0), workoutTitle: 'A', now });
    expect(texts.message).toContain('começou hoje às 01:00');
    expect(texts.finishLabel).toBe('Finalizar');
  });

  it('works without a title', () => {
    const texts = forgottenSessionTexts({ t: fr, locale: 'fr', startedAt: iso(9, 18, 40), workoutTitle: '', now });
    expect(texts.message).toMatch(/^Votre séance a commencé hier/);
  });
});
