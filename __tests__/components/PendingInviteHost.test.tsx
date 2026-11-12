import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../src/services/coachService', () => {
  const actual = jest.requireActual('../../src/services/coachService') as Record<string, unknown>;
  return { ...actual, getInviteCoachName: jest.fn(), joinCoach: jest.fn() };
});

import { CoachCodeError, getInviteCoachName, joinCoach } from '../../src/services/coachService';
import { PendingInviteHost } from '../../src/components/PendingInviteHost';
import { useDialogStore } from '../../src/store/useDialogStore';

const coachName = getInviteCoachName as jest.MockedFunction<typeof getInviteCoachName>;
const join = joinCoach as jest.MockedFunction<typeof joinCoach>;
const KEY = 'pendingCoachInvite';
// ConfirmModal's confirm/cancel have no button role yet, so they are found by text.

const renderHost = async (enabled = true) => {
  const onJoined = jest.fn();
  render(<PendingInviteHost enabled={enabled} onJoined={onJoined} />);
  await act(async () => {});
  return onJoined;
};

beforeEach(() => {
  coachName.mockReset();
  join.mockReset();
  localStorage.removeItem(KEY);
  useDialogStore.setState({ alert: null });
});

describe('PendingInviteHost', () => {
  it('does nothing without a pending invite or before sign-in', async () => {
    await renderHost();
    localStorage.setItem(KEY, 'ABCD');
    await renderHost(false);
    expect(coachName).not.toHaveBeenCalled();
    expect(screen.queryByText(/Treinar com/)).toBeNull();
  });

  it('asks to train with the coach of the link; accepting joins, clears the invite and reports', async () => {
    localStorage.setItem(KEY, 'ABCD');
    coachName.mockResolvedValue('Carla');
    join.mockResolvedValue('Carla');
    const onJoined = await renderHost();

    expect(coachName).toHaveBeenCalledWith('ABCD');
    expect(screen.getByText('Treinar com Carla?')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('Aceitar convite'));
    });

    expect(join).toHaveBeenCalledWith('ABCD');
    expect(onJoined).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(useDialogStore.getState().alert?.message).toBe('Agora Carla acompanha seus treinos.');
    expect(screen.queryByText('Treinar com Carla?')).toBeNull();
  });

  it('cancel drops the invite without joining', async () => {
    localStorage.setItem(KEY, 'ABCD');
    coachName.mockResolvedValue('Carla');
    await renderHost();
    fireEvent.click(screen.getByText('Cancelar'));
    expect(join).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(screen.queryByText('Treinar com Carla?')).toBeNull();
  });

  it('unknown code: clears it and explains', async () => {
    localStorage.setItem(KEY, 'ZZZZ');
    coachName.mockResolvedValue(null);
    await renderHost();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(useDialogStore.getState().alert?.message).toBe('Código não encontrado. Confira com seu personal.');
  });

  it('offline: keeps the code to try again on the next start', async () => {
    localStorage.setItem(KEY, 'ABCD');
    coachName.mockRejectedValue(new Error('offline'));
    await renderHost();
    expect(localStorage.getItem(KEY)).toBe('ABCD');
    expect(useDialogStore.getState().alert).toBeNull();
  });

  it('joining one\'s own code shows the specific message and does not call onJoined', async () => {
    localStorage.setItem(KEY, 'ABCD');
    coachName.mockResolvedValue('Eu');
    join.mockRejectedValue(new CoachCodeError('own'));
    const onJoined = await renderHost();
    await act(async () => {
      fireEvent.click(screen.getByText('Aceitar convite'));
    });
    expect(onJoined).not.toHaveBeenCalled();
    expect(useDialogStore.getState().alert?.message).toBe('Esse é o seu próprio código de personal.');
  });

  it('other join errors show their message', async () => {
    localStorage.setItem(KEY, 'ABCD');
    coachName.mockResolvedValue('Carla');
    join.mockRejectedValue(new Error('Network down'));
    await renderHost();
    await act(async () => {
      fireEvent.click(screen.getByText('Aceitar convite'));
    });
    expect(useDialogStore.getState().alert?.message).toBe('Network down');
  });
});
