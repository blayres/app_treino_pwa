import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n';
import { spacing } from '../theme';
import type { ExerciseLibrary } from '../services/types';
import type { ExerciseVideo } from '../services/videoService';
import { ExerciseLibraryCard } from './ExerciseLibraryCard';
import { ExerciseVideoPlayer } from './ExerciseVideoPlayer';
import { PillButton } from './PillButton';
import { PlayCircleIcon } from './PlayCircleIcon';

type Props = {
  library?: ExerciseLibrary | null;
  /** The coach's own video for this exercise: replaces the library animation. */
  video?: ExerciseVideo | null;
  caption?: string;
  /** More buttons on the same line, after "Como fazer" (e.g. "Alternativas"). */
  children?: React.ReactNode;
};

/**
 * "Como fazer" toggle and what it opens below the buttons: the coach's video when
 * there is one (loaded only when opened), otherwise the library animation.
 */
export function ExerciseMedia({ library, video, caption, children }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const hasMedia = !!video || !!library?.gif_url;

  if (!hasMedia && !children) return null;

  return (
    <View>
      <View style={styles.buttons}>
        {hasMedia ? (
          <PillButton label={t.howTo} icon={PlayCircleIcon} active={open} onPress={() => setOpen((v) => !v)} />
        ) : null}
        {children}
      </View>
      {open && video ? <ExerciseVideoPlayer path={video.path} caption={caption ?? t.coachVideoCaption} /> : null}
      {open && !video && library ? <ExerciseLibraryCard library={library} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, marginTop: spacing.xs },
});
