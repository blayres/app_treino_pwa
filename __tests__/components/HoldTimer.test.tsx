import React from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HoldTimer } from '../../src/components/HoldTimer';

const startName = (time: string) => `Iniciar cronômetro de ${time} · Prancha`;
const STOP = 'Parar cronômetro · Prancha';
const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-12T12:00:00.000Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('HoldTimer', () => {
  it('idle: only the stopwatch icon (no text), with the time in the accessible name', () => {
    render(<HoldTimer seconds={45} exerciseName="Prancha" />);
    const button = screen.getByRole('button', { name: startName('45 s') });
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')).toBeTruthy();
  });

  it('counts down once started', () => {
    render(<HoldTimer seconds={45} exerciseName="Prancha" />);
    fireEvent.click(screen.getByRole('button', { name: startName('45 s') }));
    expect(screen.getByRole('button', { name: STOP }).textContent).toBe('0:45');
    advance(5000);
    expect(screen.getByRole('button', { name: STOP }).textContent).toBe('0:40');
  });

  it('stop resets to the full time; the next start counts from the top', () => {
    render(<HoldTimer seconds={45} exerciseName="Prancha" />);
    fireEvent.click(screen.getByRole('button', { name: startName('45 s') }));
    advance(10_000);
    fireEvent.click(screen.getByRole('button', { name: STOP }));
    const idle = screen.getByRole('button', { name: startName('45 s') });
    expect(idle.textContent).toBe('');

    advance(10_000); // nothing runs while stopped
    fireEvent.click(idle);
    expect(screen.getByRole('button', { name: STOP }).textContent).toBe('0:45');
  });

  it('typing a new time while idle updates the countdown', () => {
    const { rerender } = render(<HoldTimer seconds={45} exerciseName="Prancha" />);
    rerender(<HoldTimer seconds={90} exerciseName="Prancha" />);
    fireEvent.click(screen.getByRole('button', { name: startName('1 min 30 s') }));
    expect(screen.getByRole('button', { name: STOP }).textContent).toBe('1:30');
    advance(1000);
    expect(screen.getByRole('button', { name: STOP }).textContent).toBe('1:29');
  });

  it('at zero: announces "Pronto!", vibrates where supported, then back to idle', () => {
    const vibrate = jest.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    try {
      render(<HoldTimer seconds={3} exerciseName="Prancha" />);
      fireEvent.click(screen.getByRole('button', { name: startName('3 s') }));
      advance(3000);
      expect(screen.getByRole('button', { name: 'Pronto! · Prancha' })).toBeTruthy();
      expect(vibrate).toHaveBeenCalledTimes(1);
      advance(3000);
      expect(screen.getByRole('button', { name: startName('3 s') })).toBeTruthy();
    } finally {
      delete (navigator as any).vibrate;
    }
  });

  it('a device without vibration still finishes', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('not supported');
      },
      configurable: true,
    });
    try {
      render(<HoldTimer seconds={1} exerciseName="Prancha" />);
      fireEvent.click(screen.getByRole('button', { name: startName('1 s') }));
      advance(1000);
      expect(screen.getByRole('button', { name: 'Pronto! · Prancha' })).toBeTruthy();
    } finally {
      delete (navigator as any).vibrate;
    }
  });
});
