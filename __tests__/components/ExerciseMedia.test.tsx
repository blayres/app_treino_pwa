import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const getVideoUrl = jest.fn(async (_path: string) => 'https://x/signed.mp4');
jest.mock('../../src/services/videoService', () => ({ getVideoUrl: (path: string) => getVideoUrl(path) }));

import { ExerciseMedia } from '../../src/components/ExerciseMedia';

const library = { id: 'l1', gif_url: 'https://x/a.gif' } as any;
const video = { exerciseId: 1, coachId: 5, path: '5/1.mp4' };

describe('ExerciseMedia', () => {
  it('without a coach video shows the library animation', () => {
    render(<ExerciseMedia library={library} />);
    expect(screen.getByRole('button', { name: 'Ver animação' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ver vídeo' })).toBeNull();
  });

  it('with a coach video loads nothing until "Ver vídeo" is tapped, then plays it with controls', async () => {
    const { container } = render(<ExerciseMedia library={library} video={video} />);
    expect(screen.queryByRole('button', { name: 'Ver animação' })).toBeNull();
    expect(getVideoUrl).not.toHaveBeenCalled();
    expect(container.querySelector('video')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ver vídeo' }));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    const player = container.querySelector('video') as HTMLVideoElement;
    expect(getVideoUrl).toHaveBeenCalledWith('5/1.mp4');
    expect(player.getAttribute('src')).toBe('https://x/signed.mp4');
    expect(player.hasAttribute('controls')).toBe(true);
    expect(player.hasAttribute('playsinline')).toBe(true);
    expect(screen.getByText('Vídeo do seu personal')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar vídeo' }));
    expect(container.querySelector('video')).toBeNull();
  });
});
