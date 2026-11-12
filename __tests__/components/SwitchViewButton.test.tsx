import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { SwitchViewButton } from '../../src/components/SwitchViewButton';

describe('SwitchViewButton', () => {
  it('shows icon and label, and switches on tap', () => {
    const onPress = jest.fn();
    render(<SwitchViewButton label="Alunos" icon={<Text>ico</Text>} onPress={onPress} />);
    expect(screen.getByText('ico')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Alunos' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses a custom accessible name when given', () => {
    render(<SwitchViewButton label="Alunos" accessibilityLabel="Ir para a área do personal" icon={null} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ir para a área do personal' })).toBeTruthy();
  });
});
