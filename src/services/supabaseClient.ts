import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { hasSupabaseConfig } from './backendMode';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// supabase-js throws on an empty URL at import time, which would break local
// (SQLite) mode and tests. Without config, build an inert client: every real
// call goes through ensureSupabaseEnabled() first, which explains the problem.
export const supabase = createClient(
  hasSupabaseConfig ? supabaseUrl : 'http://localhost.invalid',
  hasSupabaseConfig ? supabaseAnonKey : 'not-configured',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    },
  },
);

export function ensureSupabaseEnabled() {
  if (!hasSupabaseConfig) {
    throw new Error(
      'Supabase não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
}
