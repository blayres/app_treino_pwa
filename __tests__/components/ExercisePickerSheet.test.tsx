import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('../../src/services/workoutService', () => ({
  listExercises: jest.fn(),
  createCustomExercise: jest.fn(),
  deleteCustomExercise: jest.fn(),
  ExerciseInUseError: class extends Error {},
}));

import * as service from '../../src/services/workoutService';
import { ExercisePickerSheet, invalidateExerciseCatalogue } from '../../src/components/ExercisePickerSheet';
import { useI18n } from '../../src/i18n';

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

describe('ExercisePickerSheet — languages', () => {
  const catalogue = [
    { id: 1, name: 'Supino reto com halteres', name_i18n: { fr: 'Développé couché avec haltères' }, primary_muscle: 'peito', owner_id: null },
    { id: 2, name: 'Agachamento goblet', name_i18n: { fr: 'Goblet squat' }, primary_muscle: 'quadriceps', owner_id: null },
    { id: 3, name: 'Remada cavalinho', name_i18n: null, primary_muscle: null, owner_id: 4 },
  ] as any;

  it('French: names and muscles translated, sorted by the shown name; search in French or Portuguese', async () => {
    useI18n.getState().setLocale('fr');
    try {
      mocked.listExercises.mockResolvedValue(catalogue);
      const onPick = jest.fn();
      const { unmount } = render(<ExercisePickerSheet visible userId={4} selectedIds={[]} onPick={onPick} onClose={() => {}} />);
      await screen.findByText('Goblet squat');
      const names = screen.getAllByRole('button').map((b) => b.textContent ?? '').filter((text) => /squat|Développé|Remada/.test(text));
      expect(names[0]).toMatch(/^Développé couché avec haltères/);
      expect(names[1]).toMatch(/^Goblet squat/);
      expect(screen.getByText('Pectoraux')).toBeTruthy();
      expect(screen.getByText('Quadriceps')).toBeTruthy();

      const search = screen.getByRole('textbox');
      fireEvent.change(search, { target: { value: 'agachamento' } }); // Portuguese name still found
      expect(screen.getByText('Goblet squat')).toBeTruthy();
      expect(screen.queryByText('Développé couché avec haltères')).toBeNull();
      fireEvent.change(search, { target: { value: 'developpe couche' } }); // French, without accents
      expect(screen.getByText('Développé couché avec haltères')).toBeTruthy();

      // An existing name in any language doesn't offer "create".
      fireEvent.change(search, { target: { value: 'Goblet squat' } });
      expect(screen.queryByText(/^Créer/)).toBeNull();
      fireEvent.click(screen.getByText('Goblet squat'));
      expect(onPick).toHaveBeenCalledWith(catalogue[1]);
      unmount(); // before switching the language back (it reloads the list)
    } finally {
      act(() => useI18n.getState().setLocale('pt'));
    }
  });
});
