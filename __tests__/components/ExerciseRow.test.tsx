import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ExerciseRow } from '../../src/components/ExerciseRow';

const exercise = {
  id: 7,
  name: 'Supino Reto',
  scheme: '4x10-12 e 1x falha',
  rest_seconds: 90,
  tip: 'Cadência 2010',
  primary_muscle: null,
  secondary_muscle: null,
  exercise_library_id: null,
  library: null,
} as any;

const setup = (overrides: Partial<React.ComponentProps<typeof ExerciseRow>> = {}) => {
  const props = {
    exercise,
    index: 2,
    isSessionActive: false,
    isCompleted: false,
    loadNormal: '43,5',
    loadProgression: '',
    onToggle: jest.fn(),
    onChangeLoad: jest.fn(),
    onLoadFocus: jest.fn(),
    onLoadBlur: jest.fn(),
    onShowSubstitutes: jest.fn(),
    ...overrides,
  };
  render(<ExerciseRow {...props} />);
  return props;
};

describe('ExerciseRow', () => {
  it('shows name, scheme (with progression part), rest and coach notes', () => {
    setup();
    expect(screen.getByText('Supino Reto')).toBeTruthy();
    expect(screen.getByText('4x10-12 · 1x falha')).toBeTruthy();
    expect(screen.getByText('Intervalo 1min 30s')).toBeTruthy();
    expect(screen.getByText('Cadência 2010')).toBeTruthy();
    expect((screen.getByLabelText('Supino Reto · Carga (kg)') as HTMLInputElement).value).toBe('43,5');
  });

  it('reports typing with the exercise id and field, focus with its index, and blur', () => {
    const props = setup();
    const input = screen.getByLabelText('Supino Reto · Progressão');
    fireEvent.focus(input);
    expect(props.onLoadFocus).toHaveBeenCalledWith(2);
    fireEvent.change(input, { target: { value: '45' } });
    expect(props.onChangeLoad).toHaveBeenCalledWith(7, '45', 'progression');
    fireEvent.blur(input);
    expect(props.onLoadBlur).toHaveBeenCalledWith(7);
  });

  it('"Alternativas" asks the screen to show alternatives for this exercise', () => {
    const props = setup();
    expect(screen.getByText('Alternativas')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Alternativas para Supino Reto'));
    expect(props.onShowSubstitutes).toHaveBeenCalledWith(exercise);
  });

  it('only offers the checkbox while a session of this workout runs', () => {
    setup();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('a completed exercise hides details and inputs', () => {
    setup({ isSessionActive: true, isCompleted: true });
    expect(screen.getByText('Supino Reto')).toBeTruthy();
    expect(screen.queryByText('Cadência 2010')).toBeNull();
    expect(screen.queryByLabelText('Supino Reto · Carga (kg)')).toBeNull();
  });

  it('timed exercise: a "Tempo (s)" input instead of load/progression, and a countdown', () => {
    jest.useFakeTimers();
    try {
      const props = setup({ exercise: { ...exercise, name: 'Prancha', scheme: '3x30-45s' }, loadNormal: '' });
      expect(screen.queryByText('Carga (kg)')).toBeNull();
      expect(screen.queryByText('Progressão')).toBeNull();
      const input = screen.getByLabelText('Prancha · Tempo (s)') as HTMLInputElement;
      expect(input.placeholder).toBe('45'); // the target (upper end of the range)
      fireEvent.change(input, { target: { value: '60' } });
      expect(props.onChangeLoad).toHaveBeenCalledWith(7, '60', 'normal');

      // Empty input: the timer counts down the target.
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar cronômetro de 45 s · Prancha' }));
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.getByText('40 s')).toBeTruthy();
      act(() => {
        jest.advanceTimersByTime(41000);
      });
      expect(screen.getByText('Pronto!')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('timed exercise: the timer counts down the time the user typed', () => {
    setup({ exercise: { ...exercise, name: 'Prancha', scheme: '3x30s' }, loadNormal: '90' });
    expect((screen.getByLabelText('Prancha · Tempo (s)') as HTMLInputElement).value).toBe('90');
    expect(screen.getByRole('button', { name: 'Iniciar cronômetro de 1 min 30 s · Prancha' })).toBeTruthy();
    expect(screen.getByText('Iniciar')).toBeTruthy();
  });

  it('load exercise keeps the inputs and has no timer', () => {
    setup();
    expect(screen.getByText('Carga (kg)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /cronômetro/ })).toBeNull();
  });
});
