import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { FooterButton } from '../../src/components/FooterButton';

describe('FooterButton', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<FooterButton label="Salvar treino" onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar treino' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('loading keeps the label as the button name (never "Salvando…"), shows a spinner and disables', () => {
    const onPress = jest.fn();
    render(<FooterButton label="Salvar treino" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Salvar treino' });
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText(/Salvando/)).toBeNull();
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('disabled: shows the label but does not respond', () => {
    const onPress = jest.fn();
    render(<FooterButton label="Continuar" onPress={onPress} disabled />);
    expect(screen.getByText('Continuar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
