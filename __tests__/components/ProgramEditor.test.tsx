import React, { useState } from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

// The real picker talks to Supabase; a stub lets the test "pick" an exercise.
jest.mock('../../src/components/ExercisePickerSheet', () => ({
  ExercisePickerSheet: ({ visible, onPick }: any) =>
    visible ? (
      <button onClick={() => onPick({ id: 77, name: 'Remada baixa', scheme: '3x12', rest_seconds: 60 })}>pick-remada</button>
    ) : null,
}));

import { ProgramEditor } from '../../src/components/ProgramEditor';
import type { DraftDay } from '../../src/services/programService';

const supino = { id: 10, name: 'Supino', scheme: '4x10', rest_seconds: 60 } as any;
const initial: DraftDay[] = [
  {
    key: 'mon',
    workoutId: 1,
    dayOfWeek: 1,
    title: 'Peito',
    items: [{ key: 'i1', exercise: supino, name: 'Supino', scheme: '4x10', restSeconds: null, wrote: null, notes: null }],
  },
];

let latest: DraftDay[] = [];
function Harness({ days: start = initial }: { days?: DraftDay[] }) {
  const [days, setDays] = useState(start);
  latest = days;
  return <ProgramEditor userId={1} days={days} onChange={setDays} />;
}

const chip = (label: string) => screen.getByRole('checkbox', { name: label });
const visibleDays = () => latest.filter((d) => !d.hidden).map((d) => d.dayOfWeek);

describe('ProgramEditor', () => {
  it('selecting a weekday adds an empty card for it', () => {
    render(<Harness />);
    fireEvent.click(chip('Quarta'));
    expect(visibleDays()).toEqual([1, 3]);
    expect(screen.getByText('Quarta')).toBeTruthy();
  });

  it('unselecting hides the day and selecting again restores its exercises', () => {
    render(<Harness />);
    fireEvent.click(chip('Segunda'));
    expect(visibleDays()).toEqual([]);
    expect(screen.queryByText('Supino')).toBeNull();

    fireEvent.click(chip('Segunda'));
    expect(visibleDays()).toEqual([1]);
    expect(screen.getByText('Supino')).toBeTruthy();
  });

  it('edits the scheme inline and removes an exercise', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Supino 4x10'), { target: { value: '5x5' } });
    expect(latest[0].items[0].scheme).toBe('5x5');

    fireEvent.click(screen.getByLabelText('Remover Supino'));
    expect(latest[0].items).toHaveLength(0);
  });

  it('adds an exercise picked from the search', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('+ Adicionar exercício'));
    fireEvent.click(screen.getByText('pick-remada'));
    expect(latest[0].items.map((i) => i.name)).toEqual(['Supino', 'Remada baixa']);
    expect(screen.queryByText('pick-remada')).toBeNull(); // picker closed
  });

  it('"Repetir em outro dia" copies the day with its exercises', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Repetir em outro dia'));
    fireEvent.click(screen.getByText('Quinta'));
    expect(visibleDays()).toEqual([1, 4]);
    const thursday = latest.find((d) => d.dayOfWeek === 4)!;
    expect(thursday.title).toBe('Peito');
    expect(thursday.workoutId).toBeUndefined(); // a new workout, not the same row
    expect(thursday.items.map((i) => i.name)).toEqual(['Supino']);
  });

  it('"Trocar dia" onto a taken day swaps the two days', () => {
    const tuesday: DraftDay = {
      key: 'tue',
      workoutId: 2,
      dayOfWeek: 2,
      title: 'Superior A',
      items: [{ key: 'i2', exercise: supino, name: 'Supino', scheme: '4x10', restSeconds: null, wrote: null, notes: null }],
    };
    render(<Harness days={[{ ...initial[0], title: 'Inferior A' }, tuesday]} />);
    expect(screen.getByText('Segure ≡ e arraste um dia sobre outro para trocá-los.')).toBeTruthy();

    fireEvent.click(screen.getAllByText('Trocar dia')[0]); // Monday card
    fireEvent.click(screen.getByText('Trocar com Superior A'));

    expect(latest.map((d) => [d.title, d.dayOfWeek])).toEqual([['Superior A', 1], ['Inferior A', 2]]);
    expect(latest.map((d) => d.workoutId)).toEqual([2, 1]); // same workouts, swapped weekdays
  });

  it('marks exercises that will be created and lets an import suggestion be used as new', () => {
    render(
      <Harness
        days={[
          {
            key: 'tue',
            dayOfWeek: 2,
            title: '',
            items: [
              { key: 'n', exercise: null, name: 'Remada cavalinho', scheme: '3x10', restSeconds: null, wrote: null, notes: null },
              { key: 's', exercise: supino, name: 'Supino', scheme: '4x10', restSeconds: null, wrote: 'supino reto', notes: null },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText('novo')).toBeTruthy();
    fireEvent.click(screen.getByText(/Você escreveu “supino reto”/));
    expect(latest[0].items[1]).toMatchObject({ exercise: null, name: 'supino reto', wrote: null });
  });

  it('collapses long coach notes behind "Ver instruções"', () => {
    const notes = 'Primeira série: 14 a 16 repetições cadência 1010\nSegunda série (aumenta a carga): 10 a 12';
    render(<Harness days={[{ ...initial[0], items: [{ ...initial[0].items[0], notes }] }]} />);
    const toggle = screen.getByText('Ver instruções');
    fireEvent.click(toggle);
    expect(screen.getByText('Ocultar instruções')).toBeTruthy();
  });

  it('Carga/Tempo switches the exercise to time and back, keeping the sets', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: 'Supino · Carga' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Supino · Tempo' }));
    expect(latest[0].items[0].scheme).toBe('4x30s');
    expect(screen.getByRole('radio', { name: 'Supino · Tempo' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Supino · Carga' }));
    expect(latest[0].items[0].scheme).toBe('4x10-12');
  });
});
