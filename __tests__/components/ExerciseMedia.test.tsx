import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const getVideoUrl = jest.fn(async (_path: string) => 'https://x/signed.mp4');
jest.mock('../../src/services/videoService', () => ({ getVideoUrl: (path: string) => getVideoUrl(path) }));

import { ExerciseMedia } from '../../src/components/ExerciseMedia';

const library = { id: 'l1', gif_url: 'https://x/a.gif' } as any;
const video = { exerciseId: 1, coachId: 5, path: '5/1.mp4' };

describe('ExerciseMedia', () => {
  it('without a coach video, "Como fazer" opens and closes the library animation', () => {
    const { container } = render(<ExerciseMedia library={library} />);
    const button = screen.getByRole('button', { name: 'Como fazer' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('img')).toBeNull();

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Como fazer' })).toBe(button);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://x/a.gif');

    fireEvent.click(button);
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows extra buttons on the same line, even without an animation', () => {
    render(
      <ExerciseMedia library={null}>
        <button type="button">Alternativas</button>
      </ExerciseMedia>,
    );
    expect(screen.queryByRole('button', { name: 'Como fazer' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Alternativas' })).toBeTruthy();
  });

  it('with a coach video loads nothing until "Como fazer" is tapped, then plays it with controls', async () => {
    const { container } = render(<ExerciseMedia library={library} video={video} />);
    expect(container.querySelector('img')).toBeNull();
    expect(getVideoUrl).not.toHaveBeenCalled();
    expect(container.querySelector('video')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Como fazer' }));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    const player = container.querySelector('video') as HTMLVideoElement;
    expect(getVideoUrl).toHaveBeenCalledWith('5/1.mp4');
    expect(player.getAttribute('src')).toBe('https://x/signed.mp4');
    expect(player.hasAttribute('controls')).toBe(true);
    expect(player.hasAttribute('playsinline')).toBe(true);
    expect(screen.getByText('Vídeo do seu personal')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Como fazer' }));
    expect(container.querySelector('video')).toBeNull();
  });
});
