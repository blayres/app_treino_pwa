import React from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Text } from 'react-native';

import { BottomSheet } from '../../src/components/BottomSheet';

const sheet = (visible: boolean, onClose = jest.fn()) => (
  <BottomSheet visible={visible} onClose={onClose}>
    <Text>Conteúdo do painel</Text>
  </BottomSheet>
);

describe('BottomSheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing while closed', () => {
    render(sheet(false));
    expect(screen.queryByText('Conteúdo do painel')).toBeNull();
  });

  it('shows its content when opened', () => {
    const { rerender } = render(sheet(false));
    rerender(sheet(true));
    expect(screen.getByText('Conteúdo do painel')).toBeTruthy();
  });

  it('keeps the content while sliding away, then removes it', () => {
    const { rerender } = render(sheet(true));
    rerender(sheet(false));
    expect(screen.getByText('Conteúdo do painel')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.queryByText('Conteúdo do painel')).toBeNull();
  });

  it('tapping the dark backdrop closes it', () => {
    const onClose = jest.fn();
    render(sheet(true, onClose));
    fireEvent.click(screen.getByLabelText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
  });
});
