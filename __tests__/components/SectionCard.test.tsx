import React from 'react';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { SectionCard } from '../../src/components/SectionCard';

describe('SectionCard', () => {
  it('shows the title, the right label and the content', () => {
    render(
      <SectionCard title="Frequência" rightLabel="12 dias">
        <Text>conteúdo</Text>
      </SectionCard>,
    );
    expect(screen.getByText('Frequência')).toBeTruthy();
    expect(screen.getByText('12 dias')).toBeTruthy();
    expect(screen.getByText('conteúdo')).toBeTruthy();
  });

  it('a right element replaces the right label', () => {
    render(
      <SectionCard title="Alunos" rightLabel="ignored" rightElement={<Text>Ver todos</Text>} testID="card">
        <Text>lista</Text>
      </SectionCard>,
    );
    expect(screen.getByText('Ver todos')).toBeTruthy();
    expect(screen.queryByText('ignored')).toBeNull();
    expect(screen.getByTestId('card')).toBeTruthy();
  });
});
