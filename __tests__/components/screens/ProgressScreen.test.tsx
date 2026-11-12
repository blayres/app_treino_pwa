import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/progressService', () => ({
  getLoadHistoryByUser: jest.fn(),
  getCompletedSessionDates: jest.fn(),
  deleteLoadHistoryEntries: jest.fn(),
}));

import * as progressService from '../../../src/services/progressService';
import { navigation, resetNavigation, setRoute } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDialogStore } from '../../../src/store/useDialogStore';
import type { LoadHistoryRow } from '../../../src/services/progressUtils';
import ProgressScreen from '../../../src/screens/ProgressScreen';

const progress = progressService as jest.Mocked<typeof progressService>;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
type Row = LoadHistoryRow & { scheme: string };
const history: Row[] = [
  { id: 11, exercise_id: 1, exercise_name: 'Supino', load_kg: 40, recorded_at: daysAgo(20), scheme: '3x10' },
  { id: 12, exercise_id: 1, exercise_name: 'Supino', load_kg: 45.5, recorded_at: daysAgo(5), scheme: '3x10' },
  // Only inside "Tudo" (older than 6 months).
  { id: 21, exercise_id: 2, exercise_name: 'Agachamento', load_kg: 60, recorded_at: daysAgo(200), scheme: '4x8' },
];

// The screen keeps the last loaded data per user in memory: a fresh user per test.
let userId = 100;

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  userId += 1;
  useAppStore.setState({ currentUser: { id: userId, name: 'Ana' }, activeSession: null });
  useDialogStore.setState({ alert: null });
  progress.getLoadHistoryByUser.mockResolvedValue(history);
  progress.getCompletedSessionDates.mockResolvedValue([daysAgo(20).slice(0, 10), daysAgo(5).slice(0, 10)]);
  progress.deleteLoadHistoryEntries.mockResolvedValue(undefined);
});

const renderScreen = async () => {
  render(<ProgressScreen />);
  await screen.findByText('Supino');
};

const deleteButtons = () => screen.queryAllByRole('button', { name: /^Apagar registro de/ });

describe('ProgressScreen', () => {
  it('shows the stats and each exercise with its loads in pt (decimal comma), first one expanded', async () => {
    await renderScreen();
    expect(progress.getLoadHistoryByUser).toHaveBeenCalledWith(userId);
    expect(screen.getByLabelText(/^Treinos: 2 /)).toBeTruthy();
    // Current load and change (40 → 45,5 kg).
    expect(screen.getByText('45,5')).toBeTruthy();
    expect(screen.getByText('+5,5 kg · +14%')).toBeTruthy();
    // Detail of the first exercise (start / current, entries).
    expect(screen.getByText('Registros no período')).toBeTruthy();
    // The open exercise is announced as expanded.
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('aria-expanded') === 'true')).toHaveLength(1);
    expect(screen.getAllByText('45,5 kg').length).toBeGreaterThan(0);
    expect(deleteButtons()).toHaveLength(2);
    // Older than the default 3-month period.
    expect(screen.queryByText('Agachamento')).toBeNull();
  });

  it('the "Tudo" period includes older exercises and hides the records tile', async () => {
    await renderScreen();
    expect(screen.getByLabelText(/^Recordes:/)).toBeTruthy();
    // Screen readers hear which period is selected.
    expect(screen.getByRole('tab', { name: '3 meses' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Tudo' }));
    expect(screen.getByRole('tab', { name: 'Tudo' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: '3 meses' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('Agachamento')).toBeTruthy();
    expect(screen.queryByLabelText(/^Recordes:/)).toBeNull();
  });

  it('deleting an entry asks for confirmation first, then deletes its rows and removes it', async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^Apagar registro de 45,5 kg em/ }));
    expect(await screen.findByText('Apagar este registro?')).toBeTruthy();
    expect(progress.deleteLoadHistoryEntries).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Remover'));
    await waitFor(() => expect(progress.deleteLoadHistoryEntries).toHaveBeenCalledWith([12]));
    await waitFor(() => expect(deleteButtons()).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /^Apagar registro de 45,5 kg/ })).toBeNull();
  });

  it('cancelling the confirmation deletes nothing', async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^Apagar registro de 40 kg em/ }));
    fireEvent.click(await screen.findByText('Cancelar'));
    await act(async () => {});
    expect(progress.deleteLoadHistoryEntries).not.toHaveBeenCalled();
    expect(deleteButtons()).toHaveLength(2);
  });

  it('a failed delete keeps the entry and shows an error', async () => {
    progress.deleteLoadHistoryEntries.mockRejectedValue(new Error('network down'));
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /^Apagar registro de 45,5 kg em/ }));
    fireEvent.click(await screen.findByText('Remover'));
    await waitFor(() => expect(useDialogStore.getState().alert).toEqual({ title: 'Erro', message: 'network down' }));
    expect(deleteButtons()).toHaveLength(2);
  });

  it("a coach sees the student's progress read-only (no delete buttons)", async () => {
    setRoute({ studentId: '7', studentName: 'Bia' }, 'StudentProgress');
    await renderScreen();
    expect(progress.getLoadHistoryByUser).toHaveBeenCalledWith(7);
    expect(screen.getByText('Progresso de Bia')).toBeTruthy();
    expect(screen.getByText('Registros no período')).toBeTruthy();
    expect(deleteButtons()).toHaveLength(0);
  });

  it('shows the skeleton only on the first load; reopening shows the last data at once', async () => {
    let resolve: (rows: Row[]) => void = () => {};
    progress.getLoadHistoryByUser.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const first = render(<ProgressScreen />);
    expect(screen.getByLabelText('…')).toBeTruthy();
    await act(async () => resolve(history));
    expect(screen.queryByLabelText('…')).toBeNull();
    expect(screen.getByText('Supino')).toBeTruthy();
    first.unmount();

    // Reopened while the refresh is still on its way.
    progress.getLoadHistoryByUser.mockReturnValueOnce(new Promise(() => {}));
    render(<ProgressScreen />);
    expect(screen.queryByLabelText('…')).toBeNull();
    expect(screen.getByText('Supino')).toBeTruthy();
  });

  it('shows the empty state, and the error state with a working retry', async () => {
    progress.getLoadHistoryByUser.mockResolvedValueOnce([]);
    const empty = render(<ProgressScreen />);
    expect(await screen.findByText(/^Nenhum histórico de carga encontrado/)).toBeTruthy();
    empty.unmount();

    userId += 1;
    useAppStore.setState({ currentUser: { id: userId, name: 'Ana' } });
    progress.getLoadHistoryByUser.mockRejectedValueOnce(new Error('offline'));
    render(<ProgressScreen />);
    expect(await screen.findByText('Não foi possível carregar os dados de progresso.')).toBeTruthy();
    fireEvent.click(screen.getByText('Tentar novamente'));
    expect(await screen.findByText('Supino')).toBeTruthy();
  });

  it('"Voltar" goes back', async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
