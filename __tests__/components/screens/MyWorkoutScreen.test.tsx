import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/workoutService', () => ({
  archiveWorkout: jest.fn(),
  invalidateWorkoutsByUserCache: jest.fn(),
}));
jest.mock('../../../src/services/defaultWorkoutService', () => ({ applyDefaultProgram: jest.fn() }));
jest.mock('../../../src/services/programReminder', () => ({ restartProgramCycle: jest.fn() }));
// Pure helpers (visibleDays, isProgramDirty) stay real; data access is mocked.
jest.mock('../../../src/services/programService', () => ({
  ...jest.requireActual<typeof import('../../../src/services/programService')>('../../../src/services/programService'),
  loadProgramDraft: jest.fn(),
  peekProgramDraft: jest.fn(),
  saveProgram: jest.fn(),
  draftFromText: jest.fn(),
}));
jest.mock('../../../src/components/ExercisePickerSheet', () => ({
  loadExerciseCatalogue: jest.fn(async () => []),
  invalidateExerciseCatalogue: jest.fn(),
}));
// The real editor is covered by ProgramEditor.test.tsx; this stub lists the days and edits them.
jest.mock('../../../src/components/ProgramEditor', () => ({
  ProgramEditor: ({ days, onChange }: any) => (
    <div>
      {days.filter((d: any) => !d.hidden).map((d: any) => <span key={d.key}>{`day:${d.title}`}</span>)}
      <button onClick={() => onChange(days.map((d: any) => ({ ...d, title: `${d.title} v2` })))}>stub-rename</button>
      <button onClick={() => onChange(days.map((d: any, i: number) => (i === 0 ? { ...d, hidden: true } : d)))}>
        stub-unselect-first
      </button>
      <button onClick={() => onChange(days.map((d: any, i: number) => (i === 0 ? { ...d, items: [] } : d)))}>
        stub-empty-first
      </button>
    </div>
  ),
  PasteWorkoutInput: () => null,
  AddAnotherSheetButton: () => null,
}));

import * as workoutService from '../../../src/services/workoutService';
import * as defaultWorkoutService from '../../../src/services/defaultWorkoutService';
import * as programReminder from '../../../src/services/programReminder';
import * as programService from '../../../src/services/programService';
import type { DraftDay } from '../../../src/services/programService';
import { navigation, resetNavigation, setRoute } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDialogStore } from '../../../src/store/useDialogStore';
import MyWorkoutScreen from '../../../src/screens/MyWorkoutScreen';

const workouts = workoutService as jest.Mocked<typeof workoutService>;
const defaults = defaultWorkoutService as jest.Mocked<typeof defaultWorkoutService>;
const reminder = programReminder as jest.Mocked<typeof programReminder>;
const program = programService as jest.Mocked<typeof programService>;

const item = (key: string, name: string) => ({
  key, exercise: { id: 1, name, scheme: '3x10', rest_seconds: 60 } as any, name, scheme: '3x10', restSeconds: null, wrote: null, notes: null,
});
const draft: DraftDay[] = [
  { key: 'mon', workoutId: 31, dayOfWeek: 1, title: 'Superior', items: [item('a', 'Supino')] },
  { key: 'thu', workoutId: 32, dayOfWeek: 4, title: 'Inferior', items: [item('b', 'Agachamento')] },
];

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  useAppStore.setState({ currentUser: { id: 5, name: 'Ana' }, activeSession: null });
  useDialogStore.setState({ alert: null });
  program.peekProgramDraft.mockReturnValue(null);
  program.loadProgramDraft.mockResolvedValue(draft);
  program.saveProgram.mockResolvedValue(undefined);
  workouts.archiveWorkout.mockResolvedValue(undefined);
  defaults.applyDefaultProgram.mockResolvedValue(undefined);
  reminder.restartProgramCycle.mockResolvedValue(undefined);
});

const renderScreen = async () => {
  render(<MyWorkoutScreen />);
  await screen.findByText('day:Superior');
};
const saveButton = () => screen.queryByRole('button', { name: 'Salvar alterações' });

describe('MyWorkoutScreen', () => {
  it("loads the user's program (skeleton, then the days) and offers no save until something changes", async () => {
    let resolve: (days: DraftDay[]) => void = () => {};
    program.loadProgramDraft.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    render(<MyWorkoutScreen />);
    expect(screen.getByText('Editar meu treino')).toBeTruthy();
    // Skeleton: the editor and the "replace" options wait for the data.
    expect(screen.queryByText('Trocar meu treino')).toBeNull();
    await act(async () => resolve(draft));
    expect(program.loadProgramDraft).toHaveBeenCalledWith(5);
    expect(screen.getByText('day:Superior')).toBeTruthy();
    expect(screen.getByText('day:Inferior')).toBeTruthy();
    expect(screen.getByText('Trocar meu treino')).toBeTruthy();
    expect(saveButton()).toBeNull();
  });

  it('draws the last loaded program at once (no skeleton) while it refreshes', async () => {
    program.peekProgramDraft.mockReturnValue(draft);
    program.loadProgramDraft.mockReturnValue(new Promise(() => {}));
    render(<MyWorkoutScreen />);
    expect(screen.getByText('day:Superior')).toBeTruthy();
    expect(screen.getByText('Trocar meu treino')).toBeTruthy();
  });

  it('saves edits with the loaded program as the original, then reloads and confirms', async () => {
    await renderScreen();
    fireEvent.click(screen.getByText('stub-rename'));
    fireEvent.click(saveButton()!);
    await waitFor(() => expect(useDialogStore.getState().alert).toEqual({ title: 'Sucesso', message: 'Seu treino foi atualizado.' }));

    expect(program.saveProgram).toHaveBeenCalledTimes(1);
    const options = program.saveProgram.mock.calls[0][0];
    expect(options.userId).toBe(5);
    expect(options.original).toEqual(draft);
    expect(options.draft.map((d) => d.title)).toEqual(['Superior v2', 'Inferior v2']);
    expect(options.replaceAll).toBeUndefined();
    expect(options.defaultTitle(1)).toBe('Treino de Segunda');
    expect(workouts.invalidateWorkoutsByUserCache).toHaveBeenCalledWith(5);
    expect(reminder.restartProgramCycle).toHaveBeenCalledWith(5);
    expect(program.loadProgramDraft).toHaveBeenCalledTimes(2);
  });

  it('removing a day asks for confirmation (naming the day) before saving', async () => {
    await renderScreen();
    fireEvent.click(screen.getByText('stub-unselect-first'));
    fireEvent.click(saveButton()!);
    expect(await screen.findByText('Remover dias do treino?')).toBeTruthy();
    expect(screen.getByText('Dias removidos: Segunda. O histórico desses treinos continua salvo.')).toBeTruthy();
    expect(program.saveProgram).not.toHaveBeenCalled();

    // The modal's confirm button is the last "Salvar alterações" on screen.
    fireEvent.click(screen.getAllByText('Salvar alterações').at(-1)!);
    await waitFor(() => expect(program.saveProgram).toHaveBeenCalledTimes(1));
  });

  it('does not save a day without exercises', async () => {
    await renderScreen();
    fireEvent.click(screen.getByText('stub-empty-first'));
    fireEvent.click(saveButton()!);
    expect(useDialogStore.getState().alert).toEqual({
      title: '',
      message: 'Segunda: adicione pelo menos um exercício ou desmarque o dia.',
    });
    expect(program.saveProgram).not.toHaveBeenCalled();
  });

  it('replacing with the ready-made program asks first, then archives the current days and applies it', async () => {
    await renderScreen();
    fireEvent.click(screen.getByText('Usar treino pronto'));
    expect(await screen.findByText('Substituir seu treino?')).toBeTruthy();
    expect(workouts.archiveWorkout).not.toHaveBeenCalled();
    expect(defaults.applyDefaultProgram).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Substituir'));
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(workouts.archiveWorkout.mock.calls).toEqual([[31], [32]]);
    expect(defaults.applyDefaultProgram).toHaveBeenCalledWith(5);
    // Archive before applying, so the new days don't clash with the old ones.
    expect(workouts.archiveWorkout.mock.invocationCallOrder[1]).toBeLessThan(
      defaults.applyDefaultProgram.mock.invocationCallOrder[0],
    );
  });

  it('leaving with unsaved changes asks to discard them first', async () => {
    await renderScreen();
    fireEvent.click(screen.getByText('stub-rename'));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(await screen.findByText('Descartar alterações?')).toBeTruthy();
    expect(navigation.goBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Descartar'));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(program.saveProgram).not.toHaveBeenCalled();
  });

  it("a coach edits the student's program, without touching the student's update reminder", async () => {
    setRoute({ studentId: '7', studentName: 'Bia' }, 'CoachProgram');
    await renderScreen();
    expect(program.loadProgramDraft).toHaveBeenCalledWith(7);
    expect(screen.getByText('Treino de Bia')).toBeTruthy();

    fireEvent.click(screen.getByText('stub-rename'));
    fireEvent.click(saveButton()!);
    await waitFor(() => expect(useDialogStore.getState().alert?.title).toBe('Sucesso'));
    expect(program.saveProgram.mock.calls[0][0].userId).toBe(7);
    expect(reminder.restartProgramCycle).not.toHaveBeenCalled();
  });
});
