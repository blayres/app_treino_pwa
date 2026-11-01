import { describe, expect, it, jest } from '@jest/globals';

describe('supabaseClient without configuration (local mode)', () => {
  it('loads without throwing and explains the problem only when Supabase is used', () => {
    const saved = { url: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY };
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    try {
      jest.isolateModules(() => {
        const client = require('../src/services/supabaseClient');
        expect(client.supabase).toBeDefined();
        expect(() => client.ensureSupabaseEnabled()).toThrow('Supabase não configurado');
      });
    } finally {
      if (saved.url) process.env.EXPO_PUBLIC_SUPABASE_URL = saved.url;
      if (saved.key) process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = saved.key;
    }
  });
});
