import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
  Platform,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { apiService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { SmartImage } from '../../components/SmartImage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000;

type StoryData = { id: string; mediaUrl: string; type: string; createdAt?: string };

type RouteParams = {
  StoriesViewer: {
    stories: StoryData[];
    initialIndex?: number;
    userName?: string;
    userAvatar?: string;
    isOwn?: boolean;
    openPicker?: boolean;
  };
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} д`;
}

export const StoriesViewerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'StoriesViewer'>>();
  const {
    stories: initialStories = [],
    initialIndex = 0,
    userName = '',
    userAvatar,
    isOwn = false,
    openPicker = false,
  } = route.params ?? {};

  const [stories, setStories] = useState<StoryData[]>(initialStories);
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, initialStories.length - 1)));
  const [adding, setAdding] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<Animated.CompositeAnimation | null>(null);
  const openedPicker = useRef(false);

  const current = stories[index];
  const total = stories.length;

  const goNext = useCallback(() => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setImageLoaded(false);
    } else {
      navigation.goBack();
    }
  }, [index, total, navigation]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setImageLoaded(false);
    }
  }, [index]);

  const startProgress = useCallback(() => {
    progressAnim.setValue(0);
    timerRef.current?.stop();
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    timerRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
  }, [progressAnim, goNext]);

  useEffect(() => {
    if (total === 0) return;
    if (imageLoaded && !paused) {
      startProgress();
    }
    return () => {
      timerRef.current?.stop();
    };
  }, [index, imageLoaded, paused, startProgress, total]);

  useEffect(() => {
    if (openPicker && !openedPicker.current && stories.length === 0) {
      openedPicker.current = true;
      pickAndUpload();
    }
  }, []);

  const handlePressIn = useCallback(() => {
    setPaused(true);
    timerRef.current?.stop();
  }, []);

  const handlePressOut = useCallback(() => {
    setPaused(false);
  }, []);

  const handleTap = useCallback((side: 'left' | 'right') => {
    if (side === 'left') goPrev();
    else goNext();
  }, [goPrev, goNext]);

  const pickAndUpload = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ', 'Нужен доступ к галерее для добавления истории.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) {
      if (stories.length === 0) navigation.goBack();
      return;
    }

    setAdding(true);
    try {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      const { url } = await apiService.uploadFile(asset.uri, isVideo ? 'video' : 'photo');
      await apiService.createStory(url, isVideo ? 'video' : 'photo');
      Alert.alert('Готово', 'История опубликована!');
      navigation.goBack();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      Alert.alert('Ошибка', msg ?? 'Не удалось добавить историю.');
      if (stories.length === 0) navigation.goBack();
    } finally {
      setAdding(false);
    }
  }, [navigation, stories.length]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ', 'Нужен доступ к камере.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setAdding(true);
    try {
      const { url } = await apiService.uploadFile(result.assets[0].uri, 'photo');
      await apiService.createStory(url, 'photo');
      Alert.alert('Готово', 'История опубликована!');
      navigation.goBack();
    } catch {
      Alert.alert('Ошибка', 'Не удалось добавить историю.');
    } finally {
      setAdding(false);
    }
  }, [navigation]);

  // Empty state — add story screen
  if (total === 0 && isOwn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header */}
        <View style={[styles.emptyHeader, { marginTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.emptyContent}>
          {adding ? (
            <ActivityIndicator size="large" color="#FFF" />
          ) : (
            <>
              <View style={styles.emptyIconContainer}>
                <LinearGradient
                  colors={['#F58529', '#DD2A7B', '#8134AF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emptyIconGradient}
                >
                  <Ionicons name="add" size={48} color="#FFF" />
                </LinearGradient>
              </View>
              <Text style={styles.emptyTitle}>Добавьте историю</Text>
              <Text style={styles.emptySubtitle}>
                Поделитесь моментом — он исчезнет через 24 часа
              </Text>

              <View style={styles.addButtonsRow}>
                <TouchableOpacity
                  style={styles.addOption}
                  onPress={pickAndUpload}
                  activeOpacity={0.7}
                >
                  <View style={[styles.addOptionIcon, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <Ionicons name="images-outline" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.addOptionLabel}>Галерея</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addOption}
                  onPress={takePhoto}
                  activeOpacity={0.7}
                >
                  <View style={[styles.addOptionIcon, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <Ionicons name="camera-outline" size={28} color="#FFF" />
                  </View>
                  <Text style={styles.addOptionLabel}>Камера</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  if (total === 0) {
    return (
      <View style={[styles.container, styles.centeredFull]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 12, right: 16 }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.noStoriesText}>Нет активных историй</Text>
      </View>
    );
  }

  // Story viewer
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Story image */}
      <View style={styles.mediaContainer}>
        {current?.type === 'video' ? (
          <View style={[styles.mediaPlaceholder]}>
            <Ionicons name="videocam-outline" size={64} color="rgba(255,255,255,0.5)" />
          </View>
        ) : current?.mediaUrl ? (
          <SmartImage
            uri={current.mediaUrl}
            style={styles.media}
            contentFit="cover"
            onLoad={() => setImageLoaded(true)}
          />
        ) : null}
      </View>

      {/* Touch areas */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.touchRow}>
          <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => handleTap('left')}
          >
            <View style={styles.touchLeft} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => handleTap('right')}
          >
            <View style={styles.touchRight} />
          </TouchableWithoutFeedback>
        </View>
      </View>

      {/* Progress bars */}
      <View style={[styles.progressRow, { top: insets.top + 8 }]}>
        {stories.map((_, i) => (
          <View key={i} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                i < index
                  ? { flex: 1 }
                  : i === index
                    ? {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      }
                    : { width: 0 },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header — avatar, username, time, close */}
      <View style={[styles.header, { top: insets.top + 20 }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerAvatar, { backgroundColor: colors.surface }]}>
            {userAvatar ? (
              <SmartImage uri={userAvatar} style={styles.headerAvatarImage} />
            ) : (
              <Ionicons name="person" size={16} color="rgba(255,255,255,0.6)" />
            )}
          </View>
          <Text style={styles.headerUsername} numberOfLines={1}>{userName}</Text>
          <Text style={styles.headerTime}>{timeAgo(current?.createdAt)}</Text>
        </View>
        <View style={styles.headerRight}>
          {isOwn && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={pickAndUpload}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="add-circle-outline" size={26} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom actions */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
        {!isOwn ? (
          <View style={styles.replyContainer}>
            <TextInput
              style={styles.replyInput}
              placeholder="Отправить сообщение"
              placeholderTextColor="rgba(255,255,255,0.5)"
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
            />
            <TouchableOpacity style={styles.replyBtn}>
              <Ionicons name="heart-outline" size={26} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.replyBtn}>
              <Ionicons name="paper-plane-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ownBottomRow}>
            <TouchableOpacity style={styles.ownBottomBtn}>
              <Ionicons name="eye-outline" size={20} color="#FFF" />
              <Text style={styles.ownBottomText}>Просмотры</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ownBottomBtn} onPress={pickAndUpload}>
              <Ionicons name="camera-outline" size={20} color="#FFF" />
              <Text style={styles.ownBottomText}>Ещё</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Loading overlay */}
      {adding && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Загрузка...</Text>
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
  centeredFull: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Progress bars
  progressRow: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 3,
    zIndex: 20,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 1,
  },

  // Header
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 32,
    height: 32,
  },
  headerUsername: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 140,
  },
  headerTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    padding: 4,
  },

  // Media
  mediaContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  mediaPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Touch areas
  touchRow: {
    flex: 1,
    flexDirection: 'row',
  },
  touchLeft: {
    flex: 1,
  },
  touchRight: {
    flex: 2,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    zIndex: 20,
  },
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  replyInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 16,
    color: '#FFF',
    fontSize: 14,
  },
  replyBtn: {
    padding: 4,
  },
  ownBottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  ownBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ownBottomText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },

  // Close button (standalone)
  closeBtn: {
    position: 'absolute',
    zIndex: 10,
    padding: 6,
  },
  noStoriesText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },

  // Empty / add story screen
  emptyHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  addButtonsRow: {
    flexDirection: 'row',
    gap: 40,
  },
  addOption: {
    alignItems: 'center',
    gap: 10,
  },
  addOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addOptionLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 12,
  },
});
