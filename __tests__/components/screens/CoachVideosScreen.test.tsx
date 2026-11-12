/**
 * The coach videos screen is unreachable while FEATURES.coachVideos is off (the
 * route is not registered in App.tsx). Light coverage only: list, upload
 * validation and removal confirmation, so it does not rot until it is enabled.
 */
import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@react-navigation/native', () => require('../helpers/navigationMock'));
jest.mock('../../../src/services/videoService', () => ({
  ...(jest.requireActual('../../../src/services/videoService') as object),
  uploadExerciseVideo: jest.fn(),
  deleteExerciseVideo: jest.fn(),
  getCachedVideoRows: jest.fn(() => undefined),
  getVideoRows: jest.fn(async () => []),
}));
jest.mock('../../../src/hooks/useExerciseVideos', () => ({ useVideoRows: jest.fn() }));
jest.mock('../../../src/components/ExercisePickerSheet', () => ({ loadExerciseCatalogue: jest.fn() }));
jest.mock('../../../src/components/ExerciseVideoPlayer', () => ({ ExerciseVideoPlayer: () => null }));
jest.mock('../../../src/utils/pickFile', () => ({ pickFile: jest.fn() }));

import * as videoService from '../../../src/services/videoService';
import * as videoHooks from '../../../src/hooks/useExerciseVideos';
import * as picker from '../../../src/components/ExercisePickerSheet';
import * as pickFileModule from '../../../src/utils/pickFile';
import { resetNavigation } from '../helpers/navigationMock';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDialogStore } from '../../../src/store/useDialogStore';
import { locales } from '../../../src/i18n/translations';
import CoachVideosScreen from '../../../src/screens/CoachVideosScreen';

const videos = videoService as jest.Mocked<typeof videoService>;
const hooks = videoHooks as jest.Mocked<typeof videoHooks>;
const catalogue = picker as jest.Mocked<typeof picker>;
const files = pickFileModule as jest.Mocked<typeof pickFileModule>;
const t = locales.pt;

const video = { exerciseId: 2, coachId: 5, path: '5/2-1.mp4' };

beforeEach(() => {
  jest.clearAllMocks();
  resetNavigation();
  useAppStore.setState({ currentUser: { id: 5, name: 'Ana' } });
  useDialogStore.setState({ alert: null });
  hooks.useVideoRows.mockReturnValue([video]);
  catalogue.loadExerciseCatalogue.mockResolvedValue([
    { id: 1, name: 'Agachamento' },
    { id: 2, name: 'Supino' },
  ] as any);
});

describe('CoachVideosScreen (feature off: light coverage)', () => {
  it('lists the exercises with their video status', async () => {
    render(<CoachVideosScreen />);
    expect(await screen.findByText('Supino')).toBeTruthy();
    expect(catalogue.loadExerciseCatalogue).toHaveBeenCalledWith(5);
    expect(screen.getByText(t.withVideo)).toBeTruthy();
    expect(screen.getByText(t.withoutVideo)).toBeTruthy();
    expect(screen.getByText(t.coachVideosCount(1))).toBeTruthy();
  });

  it('rejects a file that is not a video without uploading', async () => {
    files.pickFile.mockResolvedValue(new File(['x'], 'notes.pdf', { type: 'application/pdf' }));
    render(<CoachVideosScreen />);
    fireEvent.click(await screen.findByRole('button', { name: t.uploadVideo }));
    await waitFor(() => expect(useDialogStore.getState().alert?.message).toBe(t.videoNotVideo));
    expect(videos.uploadExerciseVideo).not.toHaveBeenCalled();
  });

  it('removing a video asks for confirmation, then deletes it for this coach', async () => {
    videos.deleteExerciseVideo.mockResolvedValue(undefined);
    render(<CoachVideosScreen />);
    fireEvent.click(await screen.findByRole('button', { name: t.removeVideo }));
    expect(screen.getByText(t.removeVideoTitle('Supino'))).toBeTruthy();
    expect(videos.deleteExerciseVideo).not.toHaveBeenCalled();
    // The modal's confirm button is the last "Remover vídeo" on screen.
    fireEvent.click(screen.getAllByText(t.removeVideo).at(-1)!);
    await waitFor(() => expect(videos.deleteExerciseVideo).toHaveBeenCalledWith(5, video));
  });
});
