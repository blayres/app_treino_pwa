import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../src/services/supabaseClient', () => require('./helpers/supabaseMock').supabaseModule);
jest.mock('../src/services/backendMode', () => ({ backendMode: 'supabase', hasSupabaseConfig: true }));

import { filter, supabaseMock } from './helpers/supabaseMock';
import {
  buildVideoMap,
  deleteExerciseVideo,
  getVideoUrl,
  MAX_VIDEO_BYTES,
  ownVideos,
  uploadExerciseVideo,
  validateVideoFile,
  videoContentType,
  videoPath,
} from '../src/services/videoService';

const file = (name: string, type: string, size = 1000) => ({ name, type, size }) as any as File;

describe('video file checks', () => {
  it('accepts mp4 / mov / webm, using the extension when the phone gives no type', () => {
    expect(videoContentType({ name: 'a.mp4', type: 'video/mp4' })).toBe('video/mp4');
    expect(videoContentType({ name: 'IMG_0001.MOV', type: '' })).toBe('video/quicktime');
    expect(videoContentType({ name: 'foto.jpg', type: 'image/jpeg' })).toBeNull();
  });

  it('rejects non-videos and files over 50 MB', () => {
    expect(validateVideoFile(file('a.mp4', 'video/mp4'))).toBeNull();
    expect(validateVideoFile(file('a.pdf', 'application/pdf'))).toBe('notVideo');
    expect(validateVideoFile(file('a.mp4', 'video/mp4', MAX_VIDEO_BYTES + 1))).toBe('tooLarge');
  });

  it('stores each upload under the coach folder with a new name', () => {
    expect(videoPath(7, 12, 'video/quicktime', 111)).toBe('7/12-111.mov');
    expect(videoPath(7, 12, 'video/mp4', 222)).toBe('7/12-222.mp4');
  });
});

describe('which video a viewer sees', () => {
  const rows = [
    { exerciseId: 1, coachId: 5, path: '5/1.mp4' }, // own (viewer is coach 5)
    { exerciseId: 1, coachId: 9, path: '9/1.mp4' }, // their coach's
    { exerciseId: 2, coachId: 5, path: '5/2.mp4' },
  ];

  it("prefers the coach's video over one's own; ownVideos lists only own uploads", () => {
    const seen = buildVideoMap(rows, 5);
    expect(seen.get(1)?.path).toBe('9/1.mp4');
    expect(seen.get(2)?.path).toBe('5/2.mp4');
    expect([...ownVideos(rows, 5).values()].map((v) => v.path)).toEqual(['5/1.mp4', '5/2.mp4']);
  });
});

describe('storage', () => {
  beforeEach(() => supabaseMock.reset());

  it('signs a URL on demand and reuses it while valid', async () => {
    supabaseMock.queue('storage.createSignedUrl', { data: { signedUrl: 'https://x/signed' } });
    expect(await getVideoUrl('5/1.mp4')).toBe('https://x/signed');
    expect(await getVideoUrl('5/1.mp4')).toBe('https://x/signed');
    expect(supabaseMock.storageCalls).toEqual([
      { bucket: 'exercise-videos', method: 'createSignedUrl', args: ['5/1.mp4', 3600] },
    ]);
  });

  it('replacing a video uploads the new file, saves the row, then removes the old file', async () => {
    supabaseMock.queue('exercise_videos.select', { data: { storage_path: '5/3-old.mp4' } });
    await uploadExerciseVideo(5, 3, file('new.mp4', 'video/mp4'));

    const [upload, remove] = supabaseMock.storageCalls;
    expect(upload.method).toBe('upload');
    expect(String(upload.args[0])).toMatch(/^5\/3-\d+\.mp4$/);
    const [row] = supabaseMock.calls('exercise_videos', 'upsert');
    expect(row.payload).toEqual({ coach_id: 5, exercise_id: 3, storage_path: upload.args[0] });
    expect(remove).toEqual({ bucket: 'exercise-videos', method: 'remove', args: [['5/3-old.mp4']] });
  });

  it('does not leave an orphan file when saving the row fails', async () => {
    supabaseMock.queue('exercise_videos.upsert', { error: { message: 'denied' } });
    await expect(uploadExerciseVideo(5, 3, file('new.mp4', 'video/mp4'))).rejects.toEqual({ message: 'denied' });
    const [upload, remove] = supabaseMock.storageCalls;
    expect(remove).toEqual({ bucket: 'exercise-videos', method: 'remove', args: [[upload.args[0]]] });
  });

  it('removing deletes only the coach\'s row and its file', async () => {
    await deleteExerciseVideo(5, { exerciseId: 3, coachId: 5, path: '5/3-a.mp4' });
    const [del] = supabaseMock.calls('exercise_videos', 'delete');
    expect(filter(del, 'eq', 'coach_id')).toEqual(['eq', 'coach_id', 5]);
    expect(filter(del, 'eq', 'exercise_id')).toEqual(['eq', 'exercise_id', 3]);
    expect(supabaseMock.storageCalls[0]).toEqual({ bucket: 'exercise-videos', method: 'remove', args: [['5/3-a.mp4']] });
  });
});
