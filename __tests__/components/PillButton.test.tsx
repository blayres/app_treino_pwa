import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { PillButton } from '../../src/components/PillButton';

describe('PillButton', () => {
  it('calls onPress and uses the custom accessible name', () => {
    const onPress = jest.fn();
    render(<PillButton label="Como fazer" accessibilityLabel="Como fazer · Supino" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Como fazer · Supino' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('as a toggle, announces expanded/collapsed and keeps the same label', () => {
    const { rerender } = render(<PillButton label="Alternativas" active={false} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Alternativas' }).getAttribute('aria-expanded')).toBe('false');
    rerender(<PillButton label="Alternativas" active onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Alternativas' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('renders the icon with the label color', () => {
    const Icon = jest.fn((_props: { size?: number; color?: string }) => null);
    render(<PillButton label="Vídeo" icon={Icon} onPress={() => {}} />);
    expect(Icon).toHaveBeenCalled();
    expect(Icon.mock.calls[0][0]).toMatchObject({ size: 15 });
  });
});
