import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { MeasureToggle } from '../../src/components/MeasureToggle';

describe('MeasureToggle', () => {
  it('is a radio group with the current measure checked', () => {
    render(<MeasureToggle value="load" onChange={() => {}} accessibilityPrefix="Prancha" />);
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Prancha · Carga' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Prancha · Tempo' }).getAttribute('aria-checked')).toBe('false');
  });

  it('choosing the other measure reports it', () => {
    const onChange = jest.fn();
    render(<MeasureToggle value="load" onChange={onChange} accessibilityPrefix="Prancha" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Prancha · Tempo' }));
    expect(onChange).toHaveBeenCalledWith('time');
  });

  it('tapping the selected measure does nothing', () => {
    const onChange = jest.fn();
    render(<MeasureToggle value="time" onChange={onChange} accessibilityPrefix="Prancha" />);
    fireEvent.click(screen.getByRole('radio', { name: 'Prancha · Tempo' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
