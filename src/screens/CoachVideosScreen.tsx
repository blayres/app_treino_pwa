import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { showAlert } from '../store/useDialogStore';
import { useI18n } from '../i18n';
import { colors, layout } from '../theme';
import { LogoBar } from '../components/LogoBar';
import { ScreenHeader } from '../components/ScreenHeader';
import { PillButton } from '../components/PillButton';
import { ConfirmModal } from '../components/ConfirmModal';
import { Skeleton } from '../components/Skeleton';
import { ExerciseVideoPlayer } from '../components/ExerciseVideoPlayer';
import { loadExerciseCatalogue } from '../components/ExercisePickerSheet';
import { useVideoRows } from '../hooks/useExerciseVideos';
import {
  deleteExerciseVideo,
  ownVideos,
  uploadExerciseVideo,
  validateVideoFile,
  type ExerciseVideo,
} from '../services/videoService';
import type { Exercise } from '../services/types';
import { pickFile } from '../utils/pickFile';
import { normalizeSearch } from '../utils/text';
import { styles } from './CoachVideos.styles';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'CoachVideos'>;

/**
 * "Vídeos dos exercícios": the coach uploads how they teach each exercise.
 * Exercises with a video come first; each can be watched, replaced or removed.
 */
export default function CoachVideosScreen() {
  const navigation = useNavigation<Navigation>();
  const currentUser = useAppStore((s) => s.currentUser);
  const { t } = useI18n();
  const coachId = currentUser?.id;

  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [watchingId, setWatchingId] = useState<number | null>(null);
  const [toRemove, setToRemove] = useState<{ exercise: Exercise; video: ExerciseVideo } | null>(null);

  const rows = useVideoRows(coachId, reloadKey);
  const videos = useMemo(() => (coachId ? ownVideos(rows, coachId) : new Map()), [rows, coachId]);

  useEffect(() => {
    if (!coachId) return;
    loadExerciseCatalogue(coachId)
      .then(setExercises)
      .catch((err: any) => {
        setExercises([]);
        showAlert(t.saveError, err?.message ?? t.genericError);
      });
  }, [coachId, t]);

  // With video first, then by name; filtered by the search.
  const list = useMemo(() => {
    const q = normalizeSearch(query);
    return (exercises ?? [])
      .filter((e) => !q || normalizeSearch(e.name).includes(q))
      .sort((a, b) => Number(videos.has(b.id)) - Number(videos.has(a.id)) || a.name.localeCompare(b.name));
  }, [exercises, query, videos]);

  const handleUpload = useCallback(
    async (exercise: Exercise) => {
      if (!coachId || uploadingId !== null) return;
      const file = await pickFile('video/*');
      if (!file) return;
      const problem = validateVideoFile(file);
      if (problem) {
        showAlert('', problem === 'tooLarge' ? t.videoTooLarge : t.videoNotVideo);
        return;
      }
      setUploadingId(exercise.id);
      try {
        await uploadExerciseVideo(coachId, exercise.id, file);
        setReloadKey((k) => k + 1);
        setWatchingId(null);
        showAlert(t.savedSuccess, t.videoUploaded(exercise.name));
      } catch (err: any) {
        showAlert(t.saveError, err?.message ?? t.genericError);
      } finally {
        setUploadingId(null);
      }
    },
    [coachId, uploadingId, t],
  );

  const handleRemove = async () => {
    const target = toRemove;
    setToRemove(null);
    if (!target || !coachId) return;
    try {
      await deleteExerciseVideo(coachId, target.video);
      if (watchingId === target.exercise.id) setWatchingId(null);
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      showAlert(t.saveError, err?.message ?? t.genericError);
    }
  };

  if (!currentUser) return null;

  const renderItem = ({ item }: { item: Exercise }) => {
    const video = videos.get(item.id);
    const uploading = uploadingId === item.id;
    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: video ? colors.success : colors.borderSoftLight }]} />
              <Text style={styles.status}>{video ? t.withVideo : t.withoutVideo}</Text>
            </View>
          </View>
          {uploading ? (
            <ActivityIndicator color={colors.olive} accessibilityLabel={t.uploadVideo} />
          ) : video ? (
            <View style={styles.actions}>
              <PillButton
                label={watchingId === item.id ? t.hideVideo : t.watchVideo}
                onPress={() => setWatchingId((id) => (id === item.id ? null : item.id))}
              />
              <PillButton label={t.replaceVideo} onPress={() => handleUpload(item)} />
              <PillButton label={t.removeVideo} onPress={() => setToRemove({ exercise: item, video })} />
            </View>
          ) : (
            <PillButton label={t.uploadVideo} onPress={() => handleUpload(item)} />
          )}
        </View>
        {video && watchingId === item.id && <ExerciseVideoPlayer path={video.path} />}
      </View>
    );
  };

  const header = (
    <>
      <ScreenHeader onBack={() => navigation.goBack()} title={t.coachVideosTitle} subtitle={t.coachVideosDesc} />
      <Text style={styles.tips}>{t.videoTips}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t.searchExercise}
        accessibilityLabel={t.searchExercise}
        style={styles.search}
        maxLength={60}
      />
      <Text style={styles.count}>{t.coachVideosCount(videos.size)}</Text>
    </>
  );

  return (
    <SafeAreaView style={layout.screen} edges={['left', 'right']}>
      <LogoBar />
      <FlatList
        data={exercises === null ? [] : list}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        extraData={[videos, uploadingId, watchingId]}
        ListHeaderComponent={header}
        ListEmptyComponent={
          exercises === null ? (
            <View style={styles.skeletons}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} width="100%" height={64} style={{ borderRadius: 12 }} />
              ))}
            </View>
          ) : null
        }
        contentContainerStyle={layout.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
      />

      <ConfirmModal
        visible={toRemove !== null}
        title={toRemove ? t.removeVideoTitle(toRemove.exercise.name) : ''}
        message={t.removeVideoMsg}
        confirmLabel={t.removeVideo}
        cancelLabel={t.cancel}
        onConfirm={handleRemove}
        onCancel={() => setToRemove(null)}
        confirmDanger
      />
    </SafeAreaView>
  );
}
