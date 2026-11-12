import React from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { LiveTimer } from '../../src/components/LiveTimer';

const NOW = new Date('2026-11-12T12:00:00.000Z').getTime();
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('LiveTimer', () => {
  it('shows mm:ss elapsed since the start and ticks every second', () => {
    render(<LiveTimer startedAt={ago(65)} />);
    expect(screen.getByText('Duração do treino')).toBeTruthy();
    expect(screen.getByText('01:05')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByText('01:08')).toBeTruthy();
  });

  it('shows hours after one hour', () => {
    render(<LiveTimer startedAt={ago(3600 + 2 * 60 + 3)} />);
    expect(screen.getByText('01:02:03')).toBeTruthy();
  });

  it('never goes past the cap (forgotten workout)', () => {
    render(<LiveTimer startedAt={ago(5 * 3600)} capSeconds={3 * 3600} />);
    expect(screen.getByText('03:00:00')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('03:00:00')).toBeTruthy();
  });

  it('re-syncs when the tab becomes visible again', () => {
    render(<LiveTimer startedAt={ago(0)} />);
    // Background tab: intervals are throttled; time jumps without ticks.
    jest.setSystemTime(NOW + 120_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.getByText('02:00')).toBeTruthy();
  });

  it('stops ticking after unmount', () => {
    const { unmount } = render(<LiveTimer startedAt={ago(0)} />);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
