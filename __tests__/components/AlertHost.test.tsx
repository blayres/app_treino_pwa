import React from 'react';
import { describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AlertHost } from '../../src/components/AlertHost';
import { showAlert } from '../../src/store/useDialogStore';

describe('AlertHost', () => {
  it('shows showAlert() messages in the app modal and closes on OK', () => {
    render(<AlertHost />);
    expect(screen.queryByText('Sucesso')).toBeNull();

    act(() => showAlert('Sucesso', 'Nome de usuário atualizado.'));
    expect(screen.getByText('Nome de usuário atualizado.')).toBeTruthy();

    fireEvent.click(screen.getByText('OK'));
    expect(screen.queryByText('Sucesso')).toBeNull();
  });
});
