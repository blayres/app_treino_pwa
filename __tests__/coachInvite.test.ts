import { describe, expect, it } from '@jest/globals';
import { inviteCodeFromPath } from '../src/services/coachInvite';

describe('inviteCodeFromPath', () => {
  it('reads the code of an invite link, uppercased', () => {
    expect(inviteCodeFromPath('/convite/ab2cd3')).toBe('AB2CD3');
    expect(inviteCodeFromPath('/convite/AB2CD3/')).toBe('AB2CD3');
  });

  it('ignores other paths and malformed codes', () => {
    expect(inviteCodeFromPath('/home')).toBeNull();
    expect(inviteCodeFromPath('/convite/')).toBeNull();
    expect(inviteCodeFromPath('/convite/AB-CD')).toBeNull();
    expect(inviteCodeFromPath('/convite/AB2CD3/extra')).toBeNull();
  });
});
