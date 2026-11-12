import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import type { ExerciseLibrary } from '../services/types';
import { colors, spacing } from '../theme';

type Props = {
  library: ExerciseLibrary;
};

/** The library animation (GIF) of an exercise; ExerciseMedia decides when it shows. */
export function ExerciseLibraryCard({ library }: Props) {
  const [gifLoaded, setGifLoaded] = useState(false);

  if (!library.gif_url) return null;

  return (
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
  );
}

const styles = StyleSheet.create({
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
