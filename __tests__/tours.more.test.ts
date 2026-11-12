import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Local (SQLite) mode: tours seen are kept per user in localStorage.
jest.mock('../src/services/backendMode', () => ({ backendMode: 'local', hasSupabaseConfig: false }));
jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);

import { supabaseMock } from './helpers/supabaseMock';
import { ALL_TOURS, getSeenTours, saveSeenTours } from '../src/services/tours';

const store = new Map<string, string>();

beforeEach(() => {
  supabaseMock.reset();
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  };
});

afterEach(() => {
  delete (globalThis as any).localStorage;
});

describe('tours in local mode', () => {
  it('saves and reads back per user, without touching Supabase', async () => {
    await saveSeenTours(1, ['home']);
    expect(await getSeenTours(1)).toEqual(['home']);
    expect(await getSeenTours(2)).toEqual([]);
    expect(supabaseMock.queries).toHaveLength(0);
  });

  it('unreadable storage counts as all seen (never nag)', async () => {
    store.set('toursSeen:1', '{not json');
    expect(await getSeenTours(1)).toEqual(ALL_TOURS);
  });

  it('ignores a storage that refuses writes', async () => {
    (globalThis as any).localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    await expect(saveSeenTours(1, ['home'])).resolves.toBeUndefined();
  });
});
