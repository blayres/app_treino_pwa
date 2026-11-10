import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../src/services/programReminder', () => ({
  getProgramReminder: jest.fn(),
  getCachedProgramReminder: jest.fn(() => undefined),
  restartProgramCycle: jest.fn(async () => {}),
  snoozeProgramReminder: jest.fn(async () => {}),
}));

import * as reminder from '../../src/services/programReminder';
import { ProgramUpdateReminder } from '../../src/components/ProgramUpdateReminder';

const mocked = reminder as jest.Mocked<typeof reminder>;
const due = { due: true, qualifyingMonths: ['2026-09', '2026-10'], daysByMonth: {} };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProgramUpdateReminder', () => {
  it('shows at once when the answer is already known (fetched at boot)', () => {
    mocked.getCachedProgramReminder.mockReturnValueOnce(due);
    mocked.getProgramReminder.mockResolvedValue(due);
    render(<ProgramUpdateReminder userId={5} onUpdate={() => {}} />);
    expect(screen.getByText('Atualizar treino')).toBeTruthy();
  });

  it('stays hidden when the reminder is not due', async () => {
    mocked.getProgramReminder.mockResolvedValue({ ...due, due: false });
    render(<ProgramUpdateReminder userId={5} onUpdate={() => {}} />);
    await waitFor(() => expect(mocked.getProgramReminder).toHaveBeenCalledWith(5));
    expect(screen.queryByText('Hora de atualizar seu treino')).toBeNull();
  });

  it('"Atualizar treino" opens the editor', async () => {
    mocked.getProgramReminder.mockResolvedValue(due);
    const onUpdate = jest.fn();
    render(<ProgramUpdateReminder userId={5} onUpdate={onUpdate} />);
    fireEvent.click(await screen.findByText('Atualizar treino'));
    expect(onUpdate).toHaveBeenCalled();
  });

  it('"Lembrar depois" snoozes and "Já atualizei" restarts the cycle; both hide the card', async () => {
    mocked.getProgramReminder.mockResolvedValue(due);
    const { unmount } = render(<ProgramUpdateReminder userId={5} onUpdate={() => {}} />);
    fireEvent.click(await screen.findByText('Lembrar depois'));
    expect(mocked.snoozeProgramReminder).toHaveBeenCalledWith(5);
    expect(screen.queryByText('Hora de atualizar seu treino')).toBeNull();
    unmount();

    render(<ProgramUpdateReminder userId={5} onUpdate={() => {}} />);
    fireEvent.click(await screen.findByText('Já atualizei'));
    expect(mocked.restartProgramCycle).toHaveBeenCalledWith(5);
    expect(screen.queryByText('Hora de atualizar seu treino')).toBeNull();
  });
});
