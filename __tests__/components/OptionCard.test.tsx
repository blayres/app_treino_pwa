import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { OptionCard } from '../../src/components/OptionCard';

describe('OptionCard', () => {
  it('shows title, description, badge and icon, and is tappable', () => {
    const onPress = jest.fn();
    render(
      <OptionCard
        title="Usar treino pronto"
        description="Começe com um programa sugerido"
        badge="Mais rápido"
        icon={<Text>icon</Text>}
        highlight
        onPress={onPress}
      />,
    );
    expect(screen.getByText('Mais rápido')).toBeTruthy();
    expect(screen.getByText('Começe com um programa sugerido')).toBeTruthy();
    expect(screen.getByText('icon')).toBeTruthy();
    expect(screen.getByText('›')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Usar treino pronto/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled ("Em breve"): visible but not clickable, no chevron', () => {
    const onPress = jest.fn();
    render(<OptionCard title="Importar" description="Com IA" badge="Em breve" disabled onPress={onPress} />);
    const card = screen.getByRole('button', { name: /Importar/ });
    expect(screen.getByText('Em breve')).toBeTruthy();
    expect(screen.queryByText('›')).toBeNull();
    expect(card.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(card);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('no badge, no icon: just the text', () => {
    render(<OptionCard title="Manual" description="Monte do zero" onPress={() => {}} />);
    expect(screen.queryByText('Em breve')).toBeNull();
    expect(screen.getByText('Manual')).toBeTruthy();
  });
});
