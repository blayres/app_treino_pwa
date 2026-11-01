import React from 'react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../src/services/tours', () => ({
  ...(jest.requireActual('../../src/services/tours') as object),
  saveSeenTours: jest.fn(async () => {}),
}));

import { GuidedTour } from '../../src/components/GuidedTour';
import { useTourStore, useTourTarget } from '../../src/store/useTourStore';

/** A fake element on screen: the tour measures it. */
const target = { measureInWindow: (cb: (...v: number[]) => void) => cb(20, 100, 200, 60) };

function Targets({ ids }: { ids: string[] }) {
  const refs = ids.map((id) => useTourTarget(id)); // eslint-disable-line react-hooks/rules-of-hooks
  React.useEffect(() => refs.forEach((ref) => ref(target)), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Lets the tour scroll/measure the target (it waits until the position settles). */
const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(150);
    });
  }
};

describe('GuidedTour', () => {
  afterEach(() => {
    jest.useRealTimers();
    useTourStore.setState({ userId: null, seen: null, active: null });
  });

  it('walks through the steps on screen, skipping missing targets, then remembers the tour', async () => {
    jest.useFakeTimers();
    useTourStore.setState({ userId: 5, seen: [], active: null });
    render(
      <>
        <Targets ids={['home.days', 'home.frequency']} />
        <GuidedTour />
      </>,
    );

    act(() => useTourStore.getState().startIfNew('home'));
    await flush();
    expect(screen.getByText('Seus treinos da semana')).toBeTruthy();
    expect(screen.getByText('1 de 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    await flush();
    // "Editar treino" has no target on screen: skipped.
    expect(screen.getByText('Frequência')).toBeTruthy();
    expect(screen.getByText('2 de 2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(useTourStore.getState()).toMatchObject({ active: null, seen: ['home'] });
    expect(screen.queryByText('Frequência')).toBeNull();
  });

  it('"Pular" ends the tour for good', async () => {
    jest.useFakeTimers();
    useTourStore.setState({ userId: 5, seen: [], active: null });
    render(
      <>
        <Targets ids={['home.days']} />
        <GuidedTour />
      </>,
    );
    act(() => useTourStore.getState().startIfNew('home'));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Pular' }));
    expect(useTourStore.getState()).toMatchObject({ active: null, seen: ['home'] });
  });
});
