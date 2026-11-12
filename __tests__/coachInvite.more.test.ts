import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { captureInviteFromUrl, clearPendingInvite, peekPendingInvite } from '../src/services/coachInvite';

const store = new Map<string, string>();
const replaceState = jest.fn();

function setLocation(pathname: string) {
  (globalThis as any).window = { location: { pathname }, history: { replaceState } };
}

beforeEach(() => {
  store.clear();
  replaceState.mockClear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
});

afterEach(() => {
  delete (globalThis as any).window;
  delete (globalThis as any).localStorage;
});

describe('captureInviteFromUrl', () => {
  it('remembers the code of an invite link and continues at the app root', () => {
    setLocation('/convite/ab2cd3');
    captureInviteFromUrl();
    expect(peekPendingInvite()).toBe('AB2CD3');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
  });

  it('leaves any other URL alone', () => {
    setLocation('/home');
    captureInviteFromUrl();
    expect(peekPendingInvite()).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('does nothing outside a browser', () => {
    expect(() => captureInviteFromUrl()).not.toThrow();
    expect(store.size).toBe(0);
  });

  it('still moves to the root when storage is blocked (private mode)', () => {
    setLocation('/convite/ABCD');
    (globalThis as any).localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => captureInviteFromUrl()).not.toThrow();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
  });
});

describe('pending invite', () => {
  it('is cleared once handled', () => {
    store.set('pendingCoachInvite', 'ABCD');
    expect(peekPendingInvite()).toBe('ABCD');
    clearPendingInvite();
    expect(peekPendingInvite()).toBeNull();
  });

  it('reads/clears safely when storage throws or is missing', () => {
    (globalThis as any).localStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(peekPendingInvite()).toBeNull();
    expect(() => clearPendingInvite()).not.toThrow();

    delete (globalThis as any).localStorage;
    expect(peekPendingInvite()).toBeNull();
  });
});
