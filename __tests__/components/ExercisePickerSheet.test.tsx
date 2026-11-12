import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../src/services/workoutService', () => ({
  listExercises: jest.fn(),
  createCustomExercise: jest.fn(),
  deleteCustomExercise: jest.fn(),
  ExerciseInUseError: class extends Error {},
}));

import * as service from '../../src/services/workoutService';
import { ExercisePickerSheet, invalidateExerciseCatalogue } from '../../src/components/ExercisePickerSheet';

const mocked = service as jest.Mocked<typeof service>;

beforeEach(() => {
  jest.clearAllMocks();
  invalidateExerciseCatalogue();
  mocked.listExercises.mockResolvedValue([]);
  mocked.createCustomExercise.mockImplementation(async (p: any) => ({ id: 9, name: p.name, scheme: p.scheme ?? '3x10-12' }) as any);
});

async function typeNewExercise(onPick: jest.Mock) {
  render(<ExercisePickerSheet visible userId={4} selectedIds={[]} onPick={onPick} onClose={() => {}} />);
  await waitFor(() => expect(mocked.listExercises).toHaveBeenCalled());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Prancha lateral' } });
}

describe('ExercisePickerSheet — creating an exercise', () => {
  it('creates it by load by default (catalogue default scheme)', async () => {
    const onPick = jest.fn();
    await typeNewExercise(onPick);
    expect(screen.getByRole('radio', { name: 'Prancha lateral · Carga' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(await screen.findByText(/Criar/));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(mocked.createCustomExercise).toHaveBeenCalledWith({ userId: 4, name: 'Prancha lateral', scheme: undefined });
  });

  it('"Tempo" creates it as a timed exercise', async () => {
    const onPick = jest.fn();
    await typeNewExercise(onPick);
    fireEvent.click(screen.getByRole('radio', { name: 'Prancha lateral · Tempo' }));
    fireEvent.click(await screen.findByText(/Criar/));
    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(mocked.createCustomExercise).toHaveBeenCalledWith({ userId: 4, name: 'Prancha lateral', scheme: '3x30s' });
    expect((onPick.mock.calls[0][0] as any).scheme).toBe('3x30s');
  });
});
