import { beforeEach, describe, expect, it } from '@jest/globals';
import { forgetCachedProfiles, readCachedProfile, rememberProfile } from '../src/services/profileCache';

// Like the browser's localStorage: stored keys are own enumerable properties.
function installStorage() {
  const storage: Record<string, any> = {};
  Object.defineProperties(storage, {
    getItem: { value: (k: string) => (k in storage ? storage[k] : null) },
    setItem: { value: (k: string, v: string) => { storage[k] = String(v); } },
    removeItem: { value: (k: string) => { delete storage[k]; } },
  });
  (globalThis as any).localStorage = storage;
  return storage;
}

let storage: Record<string, any>;
beforeEach(() => {
  storage = installStorage();
});

describe('profileCache', () => {
  it('remembers only id and name per auth account', () => {
    rememberProfile('auth-1', { id: 5, name: 'Ana', needsOnboarding: false } as any);
    expect(JSON.parse(storage['profileCache:v1:auth-1'])).toEqual({ id: 5, name: 'Ana' });
    expect(readCachedProfile('auth-1')).toEqual({ id: 5, name: 'Ana' });
    expect(readCachedProfile('auth-2')).toBeNull();
  });

  it('ignores corrupted entries', () => {
    storage['profileCache:v1:auth-1'] = '{"id":"5"}';
    expect(readCachedProfile('auth-1')).toBeNull();
    storage['profileCache:v1:auth-1'] = 'not json';
    expect(readCachedProfile('auth-1')).toBeNull();
  });

  it('logout forgets every cached profile and nothing else', () => {
    rememberProfile('auth-1', { id: 5, name: 'Ana' });
    rememberProfile('auth-2', { id: 6, name: 'Bia' });
    storage.locale = 'pt';
    forgetCachedProfiles();
    expect(Object.keys(storage)).toEqual(['locale']);
  });
});
