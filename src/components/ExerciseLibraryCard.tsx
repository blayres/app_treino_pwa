import React, { useState, useCallback } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { ExerciseLibrary } from '../services/types';
import { colors, spacing } from '../theme';
import { useI18n } from '../i18n';
import { PillButton } from './PillButton';

type Props = {
  library: ExerciseLibrary;
};

export function ExerciseLibraryCard({ library }: Props) {
  const [gifVisible, setGifVisible] = useState(false);
  const [gifLoaded, setGifLoaded] = useState(false);
  const { t } = useI18n();

  const handleToggleGif = useCallback(() => {
    setGifVisible((v) => !v);
  }, []);

  if (!library.gif_url) return null;

  return (
    <View style={styles.card}>
      <PillButton label={gifVisible ? t.hideAnimation : t.showAnimation} onPress={handleToggleGif} />

      {gifVisible ? (
        <View style={styles.gifWrap}>
          {!gifLoaded ? (
            <View style={styles.gifPlaceholder}>
              <ActivityIndicator color={colors.olive} />
            </View>
          ) : null}
          <Image
            source={{ uri: library.gif_url }}
            style={[styles.gif, !gifLoaded && styles.gifHidden]}
            onLoad={() => setGifLoaded(true)}
            resizeMode="contain"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.xs,
  },
  gifWrap: {
    marginTop: spacing.sm,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMutedLight,
    alignItems: 'center',
  },
  gif: {
    width: '100%',
    height: 200,
  },
  gifHidden: {
    height: 0,
  },
  gifPlaceholder: {
    height: 200,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
