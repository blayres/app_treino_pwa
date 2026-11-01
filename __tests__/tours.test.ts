import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  ALL_TOURS,
  availableSteps,
  getSeenTours,
  nextAvailableStep,
  saveSeenTours,
  TOURS,
  withTourSeen,
} from '../src/services/tours';
import { useTourStore } from '../src/store/useTourStore';

const steps = TOURS.home;
const only = (...ids: string[]) => (id: string) => ids.includes(id);

describe('tour steps', () => {
  it('skips steps whose target is not on screen', () => {
    const has = only('home.days', 'home.progress');
    expect(nextAvailableStep(steps, 0, has)).toBe(0);
    expect(nextAvailableStep(steps, 1, has)).toBe(3);
    expect(nextAvailableStep(steps, 4, has)).toBe(-1);
    expect(availableSteps(steps, has)).toEqual([0, 3]);
  });

  it('every step has its texts in all languages', () => {
    const { locales } = require('../src/i18n/translations');
    for (const tour of Object.values(TOURS)) {
      for (const step of tour) {
        for (const t of Object.values(locales) as any[]) {
          expect(typeof t[step.title]).toBe('string');
          expect(typeof t[step.text]).toBe('string');
        }
      }
    }
  });

  it('withTourSeen adds once', () => {
    expect(withTourSeen(['home'], 'workout')).toEqual(['home', 'workout']);
    expect(withTourSeen(['home'], 'home')).toEqual(['home']);
  });
});

describe('seen tours storage', () => {
  beforeEach(() => supabaseMock.reset());

  it('reads the user\'s tours_seen, ignoring unknown values', async () => {
    supabaseMock.queue('profiles.select', { data: { tours_seen: ['home', 'old'] } });
    expect(await getSeenTours(5)).toEqual(['home']);
    const [query] = supabaseMock.calls('profiles', 'select');
    expect(filter(query, 'eq', 'id')).toEqual(['eq', 'id', 5]);
  });

  it('never shows tours when it cannot read them (migration missing)', async () => {
    supabaseMock.queue('profiles.select', { error: { code: '42703' } });
    expect(await getSeenTours(5)).toEqual(ALL_TOURS);
  });

  it('saves only the tours_seen column of the user', async () => {
    await saveSeenTours(5, ['home']);
    const [update] = supabaseMock.calls('profiles', 'update');
    expect(update.payload).toEqual({ tours_seen: ['home'] });
    expect(filter(update, 'eq', 'id')).toEqual(['eq', 'id', 5]);
  });
});

describe('useTourStore', () => {
  beforeEach(() => {
    supabaseMock.reset();
    useTourStore.setState({ userId: null, seen: null, active: null });
  });

  it('starts an unseen tour once and remembers it when finished', async () => {
    supabaseMock.queue('profiles.select', { data: { tours_seen: [] } });
    await useTourStore.getState().load(5);

    useTourStore.getState().startIfNew('home');
    expect(useTourStore.getState().active).toBe('home');
    useTourStore.getState().startIfNew('workout'); // one at a time
    expect(useTourStore.getState().active).toBe('home');

    useTourStore.getState().finish();
    expect(useTourStore.getState()).toMatchObject({ active: null, seen: ['home'] });
    expect(supabaseMock.calls('profiles', 'update')[0].payload).toEqual({ tours_seen: ['home'] });

    useTourStore.getState().startIfNew('home');
    expect(useTourStore.getState().active).toBeNull();
  });

  it('does nothing before the seen list is loaded; replay shows tours again', async () => {
    useTourStore.getState().startIfNew('home');
    expect(useTourStore.getState().active).toBeNull();

    supabaseMock.queue('profiles.select', { data: { tours_seen: ['home', 'workout'] } });
    await useTourStore.getState().load(5);
    useTourStore.getState().replay();
    useTourStore.getState().startIfNew('home');
    expect(useTourStore.getState().active).toBe('home');
  });
});
