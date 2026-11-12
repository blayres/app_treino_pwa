import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActionButton } from '../../src/components/ActionButton';

describe('ActionButton', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<ActionButton label="Copiar link" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: not clickable and announced as disabled', () => {
    const onPress = jest.fn();
    render(<ActionButton label="Copiar link" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Copiar link' });
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('loading: shows a spinner, keeps the accessible name and is not clickable', () => {
    const onPress = jest.fn();
    render(<ActionButton label="Salvar" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(screen.queryByText('Salvar')).toBeNull();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses a custom accessibility label when given', () => {
    render(<ActionButton label="Copiar" accessibilityLabel="Copiar link de convite" onPress={() => {}} variant="secondary" />);
    expect(screen.getByRole('button', { name: 'Copiar link de convite' })).toBeTruthy();
    expect(screen.getByText('Copiar')).toBeTruthy();
  });
});
