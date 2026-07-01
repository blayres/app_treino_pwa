import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { ExerciseLibrary } from '../services/types';
import { colors, spacing } from '../theme';
import { useI18n } from '../i18n';

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
      <Pressable
        onPress={handleToggleGif}
        style={({ pressed }) => [styles.gifToggle, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.gifToggleLabel}>
          {gifVisible ? t.hideAnimation : t.showAnimation}
        </Text>
      </Pressable>

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
  gifToggle: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.surfaceMutedLight,
    borderWidth: 1,
    borderColor: colors.borderSoftLight,
  },
  gifToggleLabel: {
    fontSize: 11,
    color: colors.olive,
    fontWeight: '500',
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
