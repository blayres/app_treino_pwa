import React, { useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../i18n';
import type { ExerciseLibrary } from '../services/types';
import type { ExerciseVideo } from '../services/videoService';
import { ExerciseLibraryCard } from './ExerciseLibraryCard';
import { ExerciseVideoPlayer } from './ExerciseVideoPlayer';
import { PillButton } from './PillButton';

type Props = {
  library?: ExerciseLibrary | null;
  /** The coach's own video for this exercise: replaces the library animation. */
  video?: ExerciseVideo | null;
  caption?: string;
};

/**
 * How an exercise is shown: the coach's video when there is one ("Ver vídeo",
 * loaded only when opened), otherwise the library animation ("Ver animação").
 */
export function ExerciseMedia({ library, video, caption }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!video) return library ? <ExerciseLibraryCard library={library} /> : null;

  return (
    <View>
      <PillButton label={open ? t.hideVideo : t.showVideo} onPress={() => setOpen((v) => !v)} />
      {open && <ExerciseVideoPlayer path={video.path} caption={caption ?? t.coachVideoCaption} />}
    </View>
  );
}
