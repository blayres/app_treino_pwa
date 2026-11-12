import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/defaultWorkoutService', () => ({
  applyDefaultProgram: jest.fn(),
  DEFAULT_PROGRAM: [
    { day_of_week: 1, title: 'Superior A', exercises: ['Supino', 'Remada'] },
    { day_of_week: 4, title: 'Inferior A', exercises: ['Agachamento'] },
  ],
}));
jest.mock('../../../src/services/workoutService', () => ({ invalidateWorkoutsByUserCache: jest.fn() }));
jest.mock('../../../src/services/authService', () => ({ markOnboarded: jest.fn() }));
// Pure helper (visibleDays) stays real; data access is mocked.
jest.mock('../../../src/services/programService', () => ({
  ...jest.requireActual<typeof import('../../../src/services/programService')>('../../../src/services/programService'),
  saveProgram: jest.fn(),
  draftFromText: jest.fn(),
}));
jest.mock('../../../src/components/ExercisePickerSheet', () => ({
  loadExerciseCatalogue: jest.fn(async () => []),
  invalidateExerciseCatalogue: jest.fn(),
}));
// The real editor is covered by ProgramEditor.test.tsx; this stub adds days.
jest.mock('../../../src/components/ProgramEditor', () => {
  const supino = { key: 'i1', exercise: { id: 1, name: 'Supino' }, name: 'Supino', scheme: '3x10', restSeconds: null, wrote: null, notes: null };
  return {
    ProgramEditor: ({ days, onChange }: any) => (
      <div>
        <button onClick={() => onChange([...days, { key: 'mon', dayOfWeek: 1, title: '', items: [supino] }])}>stub-add-monday</button>
        <button onClick={() => onChange([...days, { key: 'wed', dayOfWeek: 3, title: '', items: [] }])}>stub-add-empty-wednesday</button>
      </div>
    ),
    PasteWorkoutInput: () => null,
    AddAnotherSheetButton: () => null,
  };
});

import * as defaultWorkoutService from '../../../src/services/defaultWorkoutService';
import * as authService from '../../../src/services/authService';
import * as programService from '../../../src/services/programService';
import { navigation, resetNavigation } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDialogStore } from '../../../src/store/useDialogStore';
import OnboardingScreen from '../../../src/screens/OnboardingScreen';

const defaults = defaultWorkoutService as jest.Mocked<typeof defaultWorkoutService>;
const auth = authService as jest.Mocked<typeof authService>;
const program = programService as jest.Mocked<typeof programService>;

const goHome = { index: 0, routes: [{ name: 'Home' }] };

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  useAppStore.setState({ currentUser: { id: 5, name: 'Ana' }, activeSession: null, needsOnboarding: true });
  useDialogStore.setState({ alert: null });
  defaults.applyDefaultProgram.mockResolvedValue(undefined);
  auth.markOnboarded.mockResolvedValue(undefined);
  program.saveProgram.mockResolvedValue(undefined);
});

describe('OnboardingScreen', () => {
  it('welcomes the user with the three ways to start; import is "Em breve" and disabled', () => {
    render(<OnboardingScreen />);
    expect(screen.getByText('Boas-vindas, Ana!')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Usar treino pronto/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Montar do zero/ })).toBeTruthy();
    const importCard = screen.getByRole('button', { name: /Importar meu treino/ });
    expect(importCard.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Em breve')).toBeTruthy();
  });

  it('renders nothing for a user who already finished onboarding', () => {
    useAppStore.setState({ needsOnboarding: false });
    render(<OnboardingScreen />);
    expect(screen.queryByText('Boas-vindas, Ana!')).toBeNull();
    expect(screen.queryByText('Usar treino pronto')).toBeNull();
  });

  it('"use ready-made program" previews it, then applies it, marks the user onboarded and resets to Home', async () => {
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByText('Usar treino pronto'));
    expect(screen.getByText('Superior A')).toBeTruthy();
    expect(screen.getByText('Supino · Remada')).toBeTruthy();
    expect(defaults.applyDefaultProgram).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Começar com este treino' }));
    await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith(goHome));
    expect(defaults.applyDefaultProgram).toHaveBeenCalledWith(5);
    expect(auth.markOnboarded).toHaveBeenCalledWith(5);
    expect(defaults.applyDefaultProgram.mock.invocationCallOrder[0]).toBeLessThan(auth.markOnboarded.mock.invocationCallOrder[0]);
    expect(useAppStore.getState().needsOnboarding).toBe(false);
  });

  it('if applying the program fails, shows the error and does not mark the user onboarded', async () => {
    defaults.applyDefaultProgram.mockRejectedValue(new Error('network down'));
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByText('Usar treino pronto'));
    fireEvent.click(screen.getByRole('button', { name: 'Começar com este treino' }));
    await waitFor(() => expect(useDialogStore.getState().alert).toEqual({ title: 'Erro', message: 'network down' }));
    expect(auth.markOnboarded).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
    expect(useAppStore.getState().needsOnboarding).toBe(true);
    // The button works again for a retry.
    expect(screen.getByRole('button', { name: 'Começar com este treino' }).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('building from scratch saves the drafted days as a new program, then goes Home', async () => {
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByText('Montar do zero'));
    expect(screen.getByText('Monte seu treino')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar treino (0 dias)' }).getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(screen.getByText('stub-add-monday'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar treino (1 dia)' }));
    await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith(goHome));

    const options = program.saveProgram.mock.calls[0][0];
    expect(options.userId).toBe(5);
    expect(options.original).toEqual([]);
    expect(options.draft.map((d) => d.dayOfWeek)).toEqual([1]);
    expect(options.defaultTitle(1)).toBe('Treino de Segunda');
    expect(auth.markOnboarded).toHaveBeenCalledWith(5);
  });

  it('does not save a day without exercises', () => {
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByText('Montar do zero'));
    fireEvent.click(screen.getByText('stub-add-monday'));
    fireEvent.click(screen.getByText('stub-add-empty-wednesday'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar treino (2 dias)' }));
    expect(useDialogStore.getState().alert).toEqual({
      title: '',
      message: 'Quarta: adicione pelo menos um exercício ou desmarque o dia.',
    });
    expect(program.saveProgram).not.toHaveBeenCalled();
    expect(auth.markOnboarded).not.toHaveBeenCalled();
  });

  it('"Voltar" from the preview returns to the choices without saving', () => {
    render(<OnboardingScreen />);
    fireEvent.click(screen.getByText('Usar treino pronto'));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByText('Boas-vindas, Ana!')).toBeTruthy();
    expect(defaults.applyDefaultProgram).not.toHaveBeenCalled();
  });
});
