import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('"Ver substitutos" asks the screen to show alternatives for this exercise', () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText('Substitutos de Supino Reto'));
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
});
