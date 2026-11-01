import React from 'react';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProgressChart, Sparkline } from '../../src/components/ProgressChart';

const points = [
  { date: '2026-09-03', load_kg: 11 },
  { date: '2026-09-11', load_kg: 18 },
  { date: '2026-10-02', load_kg: 43.5 },
];

describe('ProgressChart', () => {
  it('labels the current load at the end of the line in the user language', () => {
    render(<ProgressChart points={points} width={320} locale="pt" bestDate="2026-10-02" accessibilityLabel="Gráfico" />);
    expect(screen.getAllByText('43,5 kg').length).toBeGreaterThan(0);
    expect(screen.getByText(/03 de set/)).toBeTruthy();
    expect(screen.getByLabelText('Gráfico')).toBeTruthy();
  });

  it('shows the hovered day in a tooltip', () => {
    const { container } = render(<ProgressChart points={points} width={320} locale="pt" accessibilityLabel="Gráfico" />);
    const svg = container.querySelector('svg')!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 210, right: 320, bottom: 210, x: 0, y: 0, toJSON() {} });
    const hitArea = svg.querySelectorAll('rect')[svg.querySelectorAll('rect').length - 1];
    fireEvent.mouseMove(hitArea, { clientX: 45 }); // near the first point
    expect(screen.getByText('11 kg')).toBeTruthy();
  });

  it('renders nothing without data', () => {
    const { container } = render(<ProgressChart points={[]} width={320} locale="pt" accessibilityLabel="Gráfico" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('Sparkline', () => {
  it('draws one line with an end dot', () => {
    const { container } = render(<Sparkline points={points} />);
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });
});
