import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography } from '../../theme';
import { apiService } from '../../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type RouteParams = { StoriesViewer: { stories: Array<{ id: string; mediaUrl: string; type: string }>; initialIndex?: number; userName?: string; isOwn?: boolean } };

/**
 * Полноэкранный просмотр историй: листание влево/вправо, закрытие. Для своих — возможность добавить историю при пустом списке.
 */
export const StoriesViewerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'StoriesViewer'>>();
  const { stories: initialStories = [], initialIndex = 0, userName = '', isOwn = false } = route.params ?? {};

  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, initialStories.length - 1)));
  const [adding, setAdding] = useState(false);

  const stories = initialStories;
  const current = stories[index];
  const hasNext = index < stories.length - 1;
  const hasPrev = index > 0;

  const goNext = useCallback(() => {
    if (hasNext) setIndex((i) => i + 1);
    else navigation.goBack();
  }, [hasNext, navigation]);

  const goPrev = useCallback(() => {
    if (hasPrev) setIndex((i) => i - 1);
  }, [hasPrev]);

  const addStory = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ', 'Нужен доступ к галерее.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setAdding(true);
    try {
      const { url } = await apiService.uploadFile(result.assets[0].uri, 'photo');
      await apiService.createStory(url, 'photo');
      navigation.goBack();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      Alert.alert('Ошибка', msg ?? 'Не удалось добавить историю.');
    } finally {
      setAdding(false);
    }
  }, [navigation]);

  if (stories.length === 0 && isOwn) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.emptyTitleLight}>Ваша история</Text>
        <Text style={styles.emptySubtitleLight}>Добавьте фото или видео — оно исчезнет через 24 часа</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={addStory}
          disabled={adding}
          activeOpacity={0.8}
        >
          {adding ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <>
              <Ionicons name="add" size={24} color={colors.surface} />
              <Text style={styles.addBtnText}>Добавить историю</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.emptySubtitleLight}>Нет активных историй</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <TouchableOpacity style={styles.halfTouchLeft} onPress={goPrev} activeOpacity={1} />
        <TouchableOpacity style={styles.halfTouchRight} onPress={goNext} activeOpacity={1} />
      </View>
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + spacing.sm }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={28} color="#FFF" />
      </TouchableOpacity>
      {userName ? (
        <View style={[styles.captionBar, { top: insets.top + spacing.sm }]}>
          <Text style={styles.captionText} numberOfLines={1}>{userName}</Text>
        </View>
      ) : null}
      <View style={styles.storyContent}>
        {current.type === 'video' ? (
          <View style={styles.mediaPlaceholder}>
            <Ionicons name="videocam-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.mediaHint}>Видео</Text>
          </View>
        ) : (
          <Image source={{ uri: current.mediaUrl }} style={styles.media} resizeMode="contain" />
        )}
      </View>
      {!hasNext && (
        <View style={[styles.tapHintWrap, { bottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.tapHint}>Нажмите для выхода</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  halfTouchLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  halfTouchRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  closeBtn: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
    padding: spacing.sm,
  },
  captionBar: {
    position: 'absolute',
    left: spacing.lg,
    right: 60,
    zIndex: 10,
    justifyContent: 'center',
  },
  captionText: {
    ...typography.bodyBold,
    color: '#FFF',
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaHint: {
    ...typography.body,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  tapHintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapHint: {
    ...typography.captionMuted,
    color: 'rgba(255,255,255,0.6)',
  },
  emptyTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyTitleLight: {
    ...typography.title,
    color: '#FFF',
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  emptySubtitleLight: {
    ...typography.body,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  addBtnText: {
    ...typography.bodyBold,
    color: colors.surface,
  },
});
