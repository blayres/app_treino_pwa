import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../src/services/substituteService', () => ({ getExerciseSubstitutes: jest.fn() }));

import * as service from '../../src/services/substituteService';
import { SubstitutesSheet } from '../../src/components/SubstitutesSheet';

const mocked = service as jest.Mocked<typeof service>;
const supino = { id: 1, name: 'Supino na Máquina', primary_muscle: 'peito', scheme: '4x10' } as any;

describe('SubstitutesSheet', () => {
  it('lists the alternatives with muscle and scheme', async () => {
    mocked.getExerciseSubstitutes.mockResolvedValue([
      { id: 3, name: 'Supino reto com halteres', primary_muscle: 'peito', scheme: '3x10-12', library: null } as any,
      { id: 2, name: 'Flexão de braço', primary_muscle: 'peito', scheme: '3x12-15', library: null } as any,
    ]);
    render(<SubstitutesSheet exercise={supino} userId={5} onClose={() => {}} />);

    expect(screen.getByText('Alternativas para Supino na Máquina')).toBeTruthy();
    expect(await screen.findByText('Supino reto com halteres')).toBeTruthy();
    expect(screen.getByText('Peito · 3x12-15')).toBeTruthy();
    expect(mocked.getExerciseSubstitutes).toHaveBeenCalledWith(supino, 5);
  });

  it('explains when there are none, and removes the panel after closing', async () => {
    mocked.getExerciseSubstitutes.mockResolvedValue([]);
    const { rerender } = render(<SubstitutesSheet exercise={supino} userId={5} onClose={() => {}} />);
    expect(await screen.findByText('Nenhuma alternativa encontrada para este exercício.')).toBeTruthy();

    // Closing slides the panel away first, keeping its title, then removes it.
    rerender(<SubstitutesSheet exercise={null} userId={5} onClose={() => {}} />);
    expect(screen.getByText('Alternativas para Supino na Máquina')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Alternativas para Supino na Máquina')).toBeNull());
  });
});
