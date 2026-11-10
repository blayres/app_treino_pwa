import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SwitchViewButton } from '../../src/components/SwitchViewButton';

describe('ScreenHeader with an action', () => {
  it('shows "Voltar" and the switch button on the same row, both clickable', () => {
    const onBack = jest.fn();
    const onSwitch = jest.fn();
    render(
      <ScreenHeader
        onBack={onBack}
        title="Área do personal"
        action={<SwitchViewButton label="Meu treino" icon={null} onPress={onSwitch} />}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Meu treino' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Área do personal' })).toBeTruthy();
  });
});
