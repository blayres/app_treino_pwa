import React from 'react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { ExerciseLibraryCard } from '../../src/components/ExerciseLibraryCard';

// react-native-web loads images through `new window.Image()`; jsdom never fires
// its load event, so the test captures those images and "loads" them by hand.
const OriginalImage = window.Image;
const created: HTMLImageElement[] = [];
function captureImages() {
  (window as any).Image = function FakeImage() {
    const image = new OriginalImage();
    (image as any).decode = undefined; // fall back to setTimeout in the loader
    created.push(image);
    return image;
  };
}

afterEach(() => {
  window.Image = OriginalImage;
  created.length = 0;
  jest.useRealTimers();
});

describe('ExerciseLibraryCard', () => {
  it('renders nothing when the exercise has no animation', () => {
    const { container } = render(<ExerciseLibraryCard library={{ id: 'l1', gif_url: null } as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows a spinner until the GIF has loaded, then only the GIF', async () => {
    jest.useFakeTimers();
    captureImages();
    const { container } = render(<ExerciseLibraryCard library={{ id: 'l1', gif_url: 'https://x/a.gif' } as any} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/a.gif');

    const request = created.find((image) => image.src === 'https://x/a.gif')!;
    await act(async () => {
      request.onload?.(new Event('load'));
      jest.runOnlyPendingTimers();
    });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
