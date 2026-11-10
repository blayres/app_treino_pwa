import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../src/services/sessionFinisher', () => ({
  clearSessionChecklist: jest.fn(),
  persistSessionEnd: jest.fn(async () => {}),
}));
jest.mock('../../src/services/workoutService', () => ({
  getWorkoutTitle: jest.fn(async () => 'Superiores'),
}));

import * as finisher from '../../src/services/sessionFinisher';
import { ForgottenWorkoutHost } from '../../src/components/ForgottenWorkoutHost';
import { useAppStore } from '../../src/store/useAppStore';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();
// Yesterday 18:40 local: always "ontem" and always more than 3h ago.
const yesterdayEvening = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 18, 40).toISOString();
};
const startSession = (startedAt: string) =>
  useAppStore.setState({
    currentUser: { id: 5, name: 'Ana' },
    activeSession: { sessionId: 77, workoutId: 3, startedAt, isRunning: true },
  });

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

describe('ForgottenWorkoutHost', () => {
  it('stays hidden for a workout open less than 3 hours', async () => {
    startSession(hoursAgo(2));
    render(<ForgottenWorkoutHost enabled />);
    await act(async () => {});
    expect(screen.queryByText('Esqueceu de finalizar?')).toBeNull();
  });

  it('asks about a workout started yesterday and finishes it on that day', async () => {
    startSession(yesterdayEvening());
    render(<ForgottenWorkoutHost enabled />);

    expect(await screen.findByText('Esqueceu de finalizar?')).toBeTruthy();
    expect(screen.getByText(/Seu treino "Superiores" começou ontem/)).toBeTruthy();
    fireEvent.click(screen.getByText(/^Finalizar no dia/));

    expect(useAppStore.getState().activeSession).toBeNull();
    expect(finisher.clearSessionChecklist).toHaveBeenCalledWith(3);
    expect(finisher.persistSessionEnd).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 5, cancelOnly: false, session: expect.objectContaining({ sessionId: 77 }) }),
    );
    expect(sessionStorage.getItem('workoutCompletedToast')).toBe('true');
    expect(screen.queryByText('Esqueceu de finalizar?')).toBeNull();
  });

  it('"Descartar treino" asks for confirmation before discarding', async () => {
    startSession(yesterdayEvening());
    render(<ForgottenWorkoutHost enabled />);
    fireEvent.click(await screen.findByText('Descartar treino'));
    expect(finisher.persistSessionEnd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Descartar'));
    expect(finisher.persistSessionEnd).toHaveBeenCalledWith(expect.objectContaining({ cancelOnly: true }));
    expect(sessionStorage.getItem('workoutCompletedToast')).toBeNull();
  });

  it('"Continuar treinando" just closes the prompt and keeps the workout running', async () => {
    startSession(hoursAgo(4));
    render(<ForgottenWorkoutHost enabled />);
    fireEvent.click(await screen.findByText('Continuar treinando'));
    expect(screen.queryByText('Esqueceu de finalizar?')).toBeNull();
    expect(useAppStore.getState().activeSession).not.toBeNull();
    expect(finisher.persistSessionEnd).not.toHaveBeenCalled();
  });

  it('stays hidden while disabled (e.g. during onboarding)', async () => {
    startSession(yesterdayEvening());
    render(<ForgottenWorkoutHost enabled={false} />);
    await act(async () => {});
    expect(screen.queryByText('Esqueceu de finalizar?')).toBeNull();
  });
});
