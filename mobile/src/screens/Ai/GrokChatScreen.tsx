import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';
import { apiService } from '../../services/api';

/* ─── types ─── */

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

type AiMode = 'chat' | 'image' | 'video';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  media?: string[];
  mediaType?: 'image' | 'video';
  videoPolling?: boolean;
}

interface ApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

/* ─── constants ─── */

const SYSTEM_PROMPT =
  'Ты полезный помощник для пользователей приложения HeirLink. Отвечай кратко и по делу. Ты можешь анализировать фотографии и давать советы.';

const MAX_IMAGES = 4;
const VIDEO_POLL_INTERVAL = 3000;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const MODE_CONFIG: Record<AiMode, { icon: string; label: string; placeholder: string; color: string }> = {
  chat: { icon: 'chatbubble-outline', label: 'Чат', placeholder: 'Сообщение...', color: '#6366F1' },
  image: { icon: 'brush-outline', label: 'Фото', placeholder: 'Опишите что нужно сгенерировать...', color: '#F59E0B' },
  video: { icon: 'videocam-outline', label: 'Видео', placeholder: 'Опишите сцену для видео...', color: '#EF4444' },
};

/* ─── helpers ─── */

function sendStreamingRequest(
  url: string,
  headers: Record<string, string>,
  body: string,
  onToken: (text: string) => void,
  onError: (err: string) => void,
  onDone: () => void,
): () => void {
  const xhr = new XMLHttpRequest();
  let lastIndex = 0;
  let sseBuffer = '';

  xhr.open('POST', url, true);
  Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

  xhr.onprogress = () => {
    const newData = xhr.responseText.slice(lastIndex);
    lastIndex = xhr.responseText.length;
    sseBuffer += newData;
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        if (parsed.error) { onError(parsed.error); return; }
        if (parsed.content) onToken(parsed.content);
      } catch { /* skip */ }
    }
  };

  xhr.onloadend = () => {
    if (sseBuffer.trim()) {
      const trimmed = sseBuffer.trim();
      if (trimmed.startsWith('data: ')) {
        const payload = trimmed.slice(6);
        if (payload !== '[DONE]') {
          try {
            const parsed = JSON.parse(payload);
            if (parsed.content) onToken(parsed.content);
            if (parsed.error) onError(parsed.error);
          } catch { /* skip */ }
        }
      }
    }
    if (xhr.status >= 400) {
      try {
        const errData = JSON.parse(xhr.responseText);
        onError(errData?.message ?? `Ошибка ${xhr.status}`);
      } catch { onError(`Ошибка ${xhr.status}`); }
    }
    onDone();
  };

  xhr.onerror = () => { onError('Ошибка сети'); onDone(); };
  xhr.send(body);
  return () => xhr.abort();
}

async function uploadImageForAi(uri: string): Promise<string> {
  const result = await apiService.uploadFile(uri, 'photo', undefined, 'posts');
  const url = result.url.startsWith('http')
    ? result.url
    : `${apiService.getBaseUrl().replace('/api', '')}${result.url}`;
  return url;
}

/* ═══════════════════════════════════════════
   Fullscreen Image Viewer
   ═══════════════════════════════════════════ */

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ visible, images, initialIndex, onClose }) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: initialIndex * SCREEN_W, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const handleSave = useCallback(async () => {
    const url = images[currentIndex];
    if (!url) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках');
        return;
      }
      const localUri = FileSystem.documentDirectory + `grok_${Date.now()}.jpg`;
      const download = await FileSystem.downloadAsync(url, localUri);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      Alert.alert('Сохранено', 'Фото сохранено в галерею');
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить фото');
    }
  }, [images, currentIndex]);

  const onScroll = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx >= 0 && idx < images.length) setCurrentIndex(idx);
  }, [images.length]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={viewerStyles.backdrop}>
        <StatusBar barStyle="light-content" backgroundColor="#000" translucent={false} />

        {/* Top bar */}
        <View style={[viewerStyles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={viewerStyles.topBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {images.length > 1 && (
            <Text style={viewerStyles.counter}>{currentIndex + 1} / {images.length}</Text>
          )}
          <TouchableOpacity onPress={handleSave} style={viewerStyles.topBtn} activeOpacity={0.7}>
            <Ionicons name="download-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Images pager */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={viewerStyles.pager}
        >
          {images.map((uri, i) => (
            <View key={i} style={viewerStyles.page}>
              <Image
                source={{ uri }}
                style={viewerStyles.fullImage}
                contentFit="contain"
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const viewerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  counter: { color: '#fff', fontSize: 16, fontWeight: '600' },
  pager: { flex: 1 },
  page: { width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: SCREEN_W, height: SCREEN_H * 0.8 },
});

/* ═══════════════════════════════════════════
   Main Chat Screen
   ═══════════════════════════════════════════ */

export const GrokChatScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AiMode>('chat');
  const flatListRef = useRef<FlatList>(null);
  const streamingRef = useRef('');
  const videoPollingRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Fullscreen image viewer state
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1 },

        /* Header */
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
        headerCenter: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        },
        headerTitle: { ...typography.title },

        /* Mode tabs */
        modeTabs: {
          flexDirection: 'row',
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        modeTab: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
          borderBottomWidth: 2,
          borderBottomColor: 'transparent',
        },
        modeTabActive: {
          borderBottomWidth: 2,
        },
        modeTabLabel: {
          fontSize: 13,
          fontWeight: '500',
        },
        modeTabLabelActive: {
          fontWeight: '700',
        },

        /* Mode hint */
        modeHint: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
        },
        modeHintText: {
          fontSize: 12,
          flex: 1,
        },

        /* Error */
        errorBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        errorText: { flex: 1, ...typography.caption },

        /* Messages list */
        listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
        empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
        emptyTitle: { ...typography.title, marginTop: spacing.md },
        emptySubtitle: { ...typography.caption, marginTop: spacing.xs, textAlign: 'center' },

        /* Bubbles */
        bubbleWrap: { marginBottom: spacing.sm },
        bubbleLeft: { alignItems: 'flex-start' },
        bubbleRight: { alignItems: 'flex-end' },
        bubble: {
          maxWidth: '85%',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
        },
        bubbleUser: { borderBottomRightRadius: 4 },
        bubbleAssistant: { borderBottomLeftRadius: 4 },
        bubbleText: { ...typography.body },

        /* User media thumbnails */
        mediaThumbs: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
          marginBottom: spacing.xs,
        },
        mediaThumb: {
          width: 80,
          height: 80,
          borderRadius: 12,
        },

        /* Generated media */
        genMediaWrap: {
          marginBottom: spacing.xs,
          alignItems: 'center',
        },
        genImage: {
          width: 260,
          height: 260,
          borderRadius: 14,
          marginBottom: 4,
        },
        genVideo: {
          width: 260,
          height: 200,
          borderRadius: 14,
          marginBottom: 4,
        },
        mediaActions: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 6,
        },
        mediaActionBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 14,
        },
        mediaActionText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '600',
        },

        /* Polling */
        pollingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: spacing.xs,
        },
        pollingText: { fontSize: 13 },

        /* Attached media */
        attachedRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          gap: spacing.sm,
        },
        attachedItem: { position: 'relative' },
        attachedThumb: {
          width: 60,
          height: 60,
          borderRadius: 10,
        },
        attachedRemove: {
          position: 'absolute',
          top: -6,
          right: -6,
          width: 20,
          height: 20,
          borderRadius: 10,
          justifyContent: 'center',
          alignItems: 'center',
        },

        /* Input */
        inputRow: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          gap: spacing.xs,
        },
        attachBtn: {
          width: 40,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
        },
        input: {
          flex: 1,
          minHeight: 44,
          maxHeight: 120,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          ...typography.body,
        },
        sendBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [colors],
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  useEffect(() => {
    return () => { Object.values(videoPollingRef.current).forEach(clearInterval); };
  }, []);

  /* ─── open fullscreen viewer ─── */
  const openViewer = useCallback((images: string[], index: number = 0) => {
    setViewerImages(images);
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  /* ─── media picker ─── */
  const pickMedia = useCallback(async () => {
    if (attachedMedia.length >= MAX_IMAGES) {
      Alert.alert('Лимит', `Можно прикрепить до ${MAX_IMAGES} фото`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - attachedMedia.length,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      setAttachedMedia((prev) => [
        ...prev,
        ...result.assets.map((a) => a.uri).slice(0, MAX_IMAGES - prev.length),
      ]);
    }
  }, [attachedMedia.length]);

  const removeMedia = useCallback((idx: number) => {
    setAttachedMedia((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /* ─── save media ─── */
  const saveMediaToDevice = useCallback(async (url: string, type: 'image' | 'video') => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках');
        return;
      }
      const ext = type === 'video' ? '.mp4' : '.jpg';
      const localUri = FileSystem.documentDirectory + `grok_${Date.now()}${ext}`;
      const download = await FileSystem.downloadAsync(url, localUri);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      Alert.alert('Сохранено', type === 'video' ? 'Видео сохранено в галерею' : 'Фото сохранено в галерею');
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить файл');
    }
  }, []);

  /* ─── video polling ─── */
  const startVideoPolling = useCallback((requestId: string, messageId: string) => {
    const poll = async () => {
      try {
        const result = await apiService.getAiVideoResult(requestId);
        if (result.status === 'completed' && result.url) {
          clearInterval(videoPollingRef.current[requestId]);
          delete videoPollingRef.current[requestId];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: 'Видео готово!', media: [result.url!], mediaType: 'video', videoPolling: false }
                : m,
            ),
          );
        } else if (result.status === 'failed' || result.error) {
          clearInterval(videoPollingRef.current[requestId]);
          delete videoPollingRef.current[requestId];
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, content: `Ошибка: ${result.error ?? 'неизвестная ошибка'}`, videoPolling: false }
                : m,
            ),
          );
        }
      } catch (e: any) {
        console.warn('[GrokChat] Video poll error:', e?.message);
      }
    };
    poll();
    videoPollingRef.current[requestId] = setInterval(poll, VIDEO_POLL_INTERVAL);
  }, []);

  /* ─── handle send (dispatches to mode) ─── */

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if ((!text && attachedMedia.length === 0) || loading) return;

    if (mode === 'image') return handleSendImage();
    if (mode === 'video') return handleSendVideo();
    return handleSendChat();
  }, [inputText, loading, attachedMedia, mode]);

  /* ─── CHAT mode ─── */
  const handleSendChat = useCallback(async () => {
    const text = inputText.trim();
    if ((!text && attachedMedia.length === 0) || loading) return;

    const currentMedia = [...attachedMedia];
    setInputText('');
    setAttachedMedia([]);
    setError(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text || '📷 Фото',
      media: currentMedia.length > 0 ? currentMedia : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      let imageUrls: string[] = [];
      if (currentMedia.length > 0) {
        imageUrls = await Promise.all(currentMedia.map(uploadImageForAi));
      }

      const apiMessages: ApiMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      if (imageUrls.length > 0) {
        const parts: ContentPart[] = [];
        if (text) parts.push({ type: 'text', text });
        for (const url of imageUrls) {
          parts.push({ type: 'image_url', image_url: { url, detail: 'auto' } });
        }
        apiMessages.push({ role: 'user', content: parts });
      } else {
        apiMessages.push({ role: 'user', content: text });
      }

      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      streamingRef.current = '';
      const headers = await apiService.getAuthHeaders();
      const baseUrl = apiService.getBaseUrl();

      await new Promise<void>((resolve) => {
        sendStreamingRequest(
          `${baseUrl}/ai/chat`,
          headers,
          JSON.stringify({ messages: apiMessages, model: 'grok-4-latest', stream: true, temperature: 0.7 }),
          (token) => {
            streamingRef.current += token;
            const current = streamingRef.current;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: current } : m)),
            );
          },
          (err) => setError(err),
          () => {
            if (!streamingRef.current) {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: 'Нет ответа.' } : m)),
              );
            }
            resolve();
          },
        );
      });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Ошибка запроса к ИИ');
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, messages, attachedMedia]);

  /* ─── IMAGE mode ─── */
  const handleSendImage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || loading) return;

    const currentMedia = [...attachedMedia];
    setInputText('');
    setAttachedMedia([]);
    setError(null);

    const isStyle = currentMedia.length > 0;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: isStyle ? `🎨 Стиль: ${text}` : `🖼 Генерация: ${text}`,
      media: isStyle ? currentMedia : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const aId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: aId, role: 'assistant', content: isStyle ? 'Применяю стиль...' : 'Генерирую изображение...' },
    ]);

    try {
      let imageUrl: string | undefined;
      if (isStyle) imageUrl = await uploadImageForAi(currentMedia[0]);

      const result = await apiService.postAiGenerateImage(text, { image_url: imageUrl });
      const urls = result.images?.map((img) => img.url).filter(Boolean) ?? [];

      setMessages((prev) =>
        prev.map((m) =>
          m.id === aId
            ? {
                ...m,
                content: urls.length > 0
                  ? (isStyle ? 'Стиль применён!' : 'Готово!')
                  : 'Не удалось сгенерировать изображение.',
                media: urls.length > 0 ? urls : undefined,
                mediaType: 'image' as const,
              }
            : m,
        ),
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Ошибка генерации';
      setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, content: `Ошибка: ${msg}` } : m)));
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, attachedMedia]);

  /* ─── VIDEO mode ─── */
  const handleSendVideo = useCallback(async () => {
    const text = inputText.trim();
    if (!text || loading) return;

    const currentMedia = [...attachedMedia];
    setInputText('');
    setAttachedMedia([]);
    setError(null);

    const hasImg = currentMedia.length > 0;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: hasImg ? `🎬 Анимация: ${text}` : `🎬 Видео: ${text}`,
      media: hasImg ? currentMedia : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const aId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: aId, role: 'assistant', content: 'Генерирую видео...', videoPolling: true },
    ]);

    try {
      let imageUrl: string | undefined;
      if (hasImg) imageUrl = await uploadImageForAi(currentMedia[0]);

      const result = await apiService.postAiGenerateVideo(text, { image_url: imageUrl });
      if (result.request_id) {
        startVideoPolling(result.request_id, aId);
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === aId ? { ...m, content: 'Не удалось запустить генерацию.', videoPolling: false } : m)),
        );
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Ошибка генерации видео';
      setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, content: `Ошибка: ${msg}`, videoPolling: false } : m)));
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, attachedMedia, startVideoPolling]);

  /* ─── render message ─── */

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === 'user';
      return (
        <View style={[styles.bubbleWrap, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
          <View
            style={[
              styles.bubble,
              isUser
                ? [styles.bubbleUser, { backgroundColor: colors.primary }]
                : [styles.bubbleAssistant, { backgroundColor: colors.surface, borderColor: colors.border }],
            ]}
          >
            {/* User media thumbnails — tappable */}
            {isUser && item.media && item.media.length > 0 && (
              <View style={styles.mediaThumbs}>
                {item.media.map((uri, i) => (
                  <TouchableOpacity key={i} activeOpacity={0.8} onPress={() => openViewer(item.media!, i)}>
                    <Image source={{ uri }} style={styles.mediaThumb} contentFit="cover" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Generated media — tappable images, video player */}
            {!isUser && item.media && item.media.length > 0 && (
              <View style={styles.genMediaWrap}>
                {item.mediaType === 'video' ? (
                  <Video
                    source={{ uri: item.media[0] }}
                    style={styles.genVideo}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    isLooping
                  />
                ) : (
                  item.media.map((url, i) => (
                    <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => openViewer(item.media!, i)}>
                      <Image source={{ uri: url }} style={styles.genImage} contentFit="contain" />
                    </TouchableOpacity>
                  ))
                )}
                {/* Action buttons */}
                <View style={styles.mediaActions}>
                  <TouchableOpacity
                    style={[styles.mediaActionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => saveMediaToDevice(item.media![0], item.mediaType ?? 'image')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={styles.mediaActionText}>Сохранить</Text>
                  </TouchableOpacity>
                  {item.mediaType !== 'video' && (
                    <TouchableOpacity
                      style={[styles.mediaActionBtn, { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: colors.border }]}
                      onPress={() => openViewer(item.media!, 0)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="expand-outline" size={16} color={colors.text} />
                      <Text style={[styles.mediaActionText, { color: colors.text }]}>Открыть</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Video polling */}
            {item.videoPolling && (
              <View style={styles.pollingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.pollingText, { color: colors.textSecondary }]}>Генерация видео...</Text>
              </View>
            )}

            {/* Text */}
            {item.content ? (
              <Text style={[styles.bubbleText, { color: isUser ? '#fff' : colors.text }]}>
                {item.content}
              </Text>
            ) : !isUser ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
          </View>
        </View>
      );
    },
    [colors, saveMediaToDevice, openViewer],
  );

  const hasInput = inputText.trim().length > 0 || attachedMedia.length > 0;
  const modeConf = MODE_CONFIG[mode];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ─── Header ─── */}
      <View
        style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="sparkles" size={22} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Grok</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* ─── Mode Selector ─── */}
      <View style={[styles.modeTabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(Object.keys(MODE_CONFIG) as AiMode[]).map((m) => {
          const conf = MODE_CONFIG[m];
          const active = mode === m;
          return (
            <TouchableOpacity
              key={m}
              style={[
                styles.modeTab,
                active && [styles.modeTabActive, { borderBottomColor: conf.color }],
              ]}
              onPress={() => setMode(m)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={conf.icon as any}
                size={18}
                color={active ? conf.color : colors.textTertiary}
              />
              <Text
                style={[
                  styles.modeTabLabel,
                  { color: active ? conf.color : colors.textTertiary },
                  active && styles.modeTabLabelActive,
                ]}
              >
                {conf.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── Mode hint ─── */}
      {mode !== 'chat' && (
        <View style={[styles.modeHint, { backgroundColor: modeConf.color + '15' }]}>
          <Ionicons name="information-circle-outline" size={16} color={modeConf.color} />
          <Text style={[styles.modeHintText, { color: modeConf.color }]}>
            {mode === 'image'
              ? (attachedMedia.length > 0
                ? 'Прикреплено фото — будет применён стиль по описанию'
                : 'Опишите картинку. Прикрепите фото для стилизации')
              : (attachedMedia.length > 0
                ? 'Прикреплено фото — будет создана анимация'
                : 'Опишите сцену. Прикрепите фото для анимации')}
          </Text>
        </View>
      )}

      {/* ─── Error bar ─── */}
      {error ? (
        <View style={[styles.errorBar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.errorText, { color: colors.text }]} numberOfLines={2}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ─── Messages ─── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={7}
        initialNumToRender={10}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 140 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={modeConf.icon as any} size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {mode === 'chat' ? 'Чат с Grok' : mode === 'image' ? 'Генерация фото' : 'Генерация видео'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {mode === 'chat'
                ? 'Задайте вопрос или отправьте фото\nдля анализа'
                : mode === 'image'
                ? 'Опишите изображение или прикрепите фото\nи опишите нужный стиль'
                : 'Опишите видео или прикрепите фото\nчтобы оживить его'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ─── Attached media preview ─── */}
      {attachedMedia.length > 0 && (
        <View style={[styles.attachedRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {attachedMedia.map((uri, idx) => (
            <View key={idx} style={styles.attachedItem}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => openViewer(attachedMedia, idx)}>
                <Image source={{ uri }} style={styles.attachedThumb} contentFit="cover" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachedRemove, { backgroundColor: colors.text }]}
                onPress={() => removeMedia(idx)}
              >
                <Ionicons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ─── Input row ─── */}
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.sm },
        ]}
      >
        <TouchableOpacity style={styles.attachBtn} onPress={pickMedia} disabled={loading} activeOpacity={0.7}>
          <Ionicons
            name="image-outline"
            size={24}
            color={loading ? colors.textTertiary : colors.primary}
          />
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
          placeholder={modeConf.placeholder}
          placeholderTextColor={colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={4000}
          editable={!loading}
        />

        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: hasInput && !loading ? modeConf.color : colors.border },
          ]}
          onPress={handleSend}
          disabled={!hasInput || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={mode === 'chat' ? 'send' : mode === 'image' ? 'brush' : 'videocam'}
              size={20}
              color="#fff"
            />
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Fullscreen image viewer ─── */}
      <ImageViewer
        visible={viewerVisible}
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setViewerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
};

