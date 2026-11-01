import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { StudentRow } from '../../src/components/StudentRow';
import type { StudentSummary } from '../../src/services/coachService';

const now = new Date(2026, 10, 20, 12);
const daysAgo = (n: number) => new Date(2026, 10, 20 - n, 9).toISOString();
const base: StudentSummary = {
  id: 4,
  name: 'carla Dias',
  since: daysAgo(40),
  lastWorkoutAt: daysAgo(2),
  sessionsLast7: 3,
  sessionsLast30: 10,
  programDays: 4,
};

describe('StudentRow', () => {
  it('shows the initial, the name and how the student is training', () => {
    render(<StudentRow student={base} now={now} onPress={jest.fn()} />);
    expect(screen.getByText('C')).toBeTruthy();
    expect(screen.getByText('carla Dias')).toBeTruthy();
    expect(screen.getByText('Treinou há 2 dias · 3 treinos na semana')).toBeTruthy();
  });

  it('tells the coach what to do first', () => {
    const { rerender } = render(<StudentRow student={{ ...base, programDays: 0 }} now={now} onPress={jest.fn()} />);
    expect(screen.getByText('Sem treino montado')).toBeTruthy();
    rerender(<StudentRow student={{ ...base, lastWorkoutAt: daysAgo(12) }} now={now} onPress={jest.fn()} />);
    expect(screen.getByText('Parado há 12 dias')).toBeTruthy();
    rerender(<StudentRow student={{ ...base, lastWorkoutAt: null }} now={now} onPress={jest.fn()} />);
    expect(screen.getByText('Ainda não treinou')).toBeTruthy();
  });

  it('opens the student on press', () => {
    const onPress = jest.fn();
    render(<StudentRow student={base} now={now} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: /carla Dias/ }));
    expect(onPress).toHaveBeenCalledWith(base);
  });
});
