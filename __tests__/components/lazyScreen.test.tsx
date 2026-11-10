import React from 'react';
import { describe, expect, it } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { lazyScreen } from '../../src/navigation/lazyScreen';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

function RealScreen({ label }: { label: string }) {
  return <Text>Tela {label}</Text>;
}

describe('lazyScreen', () => {
  it('shows the static fallback (never a blank page) while the code downloads', async () => {
    const code = deferred<{ default: typeof RealScreen }>();
    const Screen = lazyScreen(() => code.promise, ({ label }: { label: string }) => <Text>Esqueleto {label}</Text>);

    render(<Screen label="A" />);
    expect(screen.getByText('Esqueleto A')).toBeTruthy();

    await act(async () => code.resolve({ default: RealScreen }));
    expect(await screen.findByText('Tela A')).toBeTruthy();
  });

  it('once preloaded, renders directly on the first frame (no fallback at all)', async () => {
    const Screen = lazyScreen(async () => ({ default: RealScreen }), () => <Text>Esqueleto</Text>);
    await Screen.preload();

    render(<Screen label="B" />);
    expect(screen.getByText('Tela B')).toBeTruthy();
    expect(screen.queryByText('Esqueleto')).toBeNull();
  });

  it('preload downloads once and can retry after a failure', async () => {
    let calls = 0;
    const Screen = lazyScreen(async () => {
      calls++;
      if (calls === 1) throw new Error('offline');
      return { default: RealScreen };
    });
    await expect(Screen.preload()).rejects.toThrow('offline');
    await Screen.preload();
    await Screen.preload();
    expect(calls).toBe(2);
  });
});
