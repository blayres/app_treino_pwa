import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { colors, spacing, typography } from '../theme';
import { getVideoUrl } from '../services/videoService';

type Props = {
  path: string;
  caption?: string;
};

/**
 * Coach video, streamed on demand. Mounted only after "Ver vídeo" is tapped:
 * asks for a short-lived URL and lets the browser's native player do the rest
 * — play/pause, dragging the progress bar back and forth, fullscreen — inline
 * (small) by default, also on iPhone (playsInline).
 */
export function ExerciseVideoPlayer({ path, caption }: Props) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setReady(false);
    setFailed(false);
    getVideoUrl(path)
      .then((signed) => !cancelled && setUrl(signed))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Pause when the player closes (row collapsed / screen left).
  useEffect(() => () => videoRef.current?.pause(), []);

  if (failed) return <Text style={styles.error}>{t.videoLoadError}</Text>;

  return (
    <View style={styles.wrap}>
      {!ready && (
        <View style={styles.placeholder}>
          <ActivityIndicator color={colors.textPrimaryDark} />
        </View>
      )}
      {url && (
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          autoPlay
          preload="metadata"
          controlsList="nodownload"
          onLoadedMetadata={() => setReady(true)}
          onError={() => setFailed(true)}
          style={{ ...videoStyle, ...(ready ? null : { position: 'absolute', opacity: 0 }) }}
        />
      )}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const PLAYER_HEIGHT = 240;

const videoStyle = {
  display: 'block',
  width: '100%',
  height: PLAYER_HEIGHT,
  objectFit: 'contain',
  backgroundColor: '#000',
  borderRadius: 10,
} as const;

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  placeholder: {
    height: PLAYER_HEIGHT,
    borderRadius: 10,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { ...typography.caption, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
});
