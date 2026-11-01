import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmModal } from '../../src/components/ConfirmModal';

describe('ConfirmModal', () => {
  it('shows title and message and calls the right handler', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(
      <ConfirmModal visible title="Excluir conta?" message="Esta ação não pode ser desfeita." confirmLabel="Excluir" cancelLabel="Cancelar" onConfirm={onConfirm} onCancel={onCancel} confirmDanger />,
    );

    expect(screen.getByText('Excluir conta?')).toBeTruthy();
    expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Excluir'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('single-button mode (alerts) has no cancel button', () => {
    render(<ConfirmModal visible title="Sucesso" message="" confirmLabel="OK" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('OK')).toBeTruthy();
    expect(screen.queryByText('Cancelar')).toBeNull();
  });

  it('renders nothing when hidden', () => {
    render(<ConfirmModal visible={false} title="Oculto" message="" confirmLabel="OK" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText('Oculto')).toBeNull();
  });
});
