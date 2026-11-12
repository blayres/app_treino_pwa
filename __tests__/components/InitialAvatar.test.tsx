import React from 'react';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { InitialAvatar } from '../../src/components/InitialAvatar';

describe('InitialAvatar', () => {
  it('shows the uppercased first letter, ignoring leading spaces', () => {
    render(<InitialAvatar name="  ana paula" />);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('keeps accented initials', () => {
    render(<InitialAvatar name="érica" />);
    expect(screen.getByText('É')).toBeTruthy();
  });

  it('shows "?" for an empty name', () => {
    render(<InitialAvatar name="   " size={48} />);
    expect(screen.getByText('?')).toBeTruthy();
  });
});
