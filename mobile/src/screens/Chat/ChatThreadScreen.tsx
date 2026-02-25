import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
  Animated,
  Alert,
  ActionSheetIOS,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { socketService } from '../../services/socketService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SmartImage } from '../../components/SmartImage';

type ChatThreadParams = { userId: string };

interface MessageItem {
  id: string;
  text: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  createdAt: string;
  isFromMe: boolean;
  sending?: boolean;
  sender?: { id: string; username: string; avatarUrl: string | null };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return d.toLocaleDateString('ru-RU', { weekday: 'long' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function shouldShowDateHeader(current: string, next: string | null): boolean {
  if (!next) return true;
  return new Date(current).toDateString() !== new Date(next).toDateString();
}

export const ChatThreadScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ ChatThread: ChatThreadParams }, 'ChatThread'>>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const paramFromRoute = route.params?.userId;
  const paramFromNavState = (() => {
    try {
      const state = navigation.getState();
      const r = state?.routes?.[state.index ?? 0] as any;
      const uid = r?.params?.userId;
      return uid != null && uid !== '' ? String(uid).trim() : undefined;
    } catch {
      return undefined;
    }
  })();
  const otherUserId = (paramFromRoute ?? paramFromNavState) != null
    ? String(paramFromRoute ?? paramFromNavState).trim()
    : undefined;

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingAnimation = useRef(new Animated.Value(0)).current;
  const typingLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const tempIdCounter = useRef(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const userQuery = useQuery({
    queryKey: ['user', otherUserId],
    queryFn: () => apiService.getUserProfile(otherUserId as string),
    enabled: !!otherUserId,
  });
  const otherUser = userQuery.data as { id: string; username: string; avatarUrl?: string | null } | undefined;

  const messagesQuery = useQuery({
    queryKey: ['messages', 'with', otherUserId],
    queryFn: async () => {
      const res = await apiService.getMessagesWith(otherUserId as string, 1, 100);
      return (res?.items ?? []) as MessageItem[];
    },
    enabled: !!otherUserId,
    staleTime: 3000,
    gcTime: 300000,
    retry: 1,
  });

  const rawMessages = (messagesQuery.data ?? []) as MessageItem[];
  const invertedMessages = useMemo(() => [...rawMessages].reverse(), [rawMessages]);

  // --- Socket: new messages, typing ---
  useEffect(() => {
    if (!otherUserId) return;
    const unsubMsg = socketService.on('newMessage', (msg: any) => {
      if (msg.senderId === otherUserId || msg.recipientId === otherUserId) {
        queryClient.setQueryData<MessageItem[]>(['messages', 'with', otherUserId], (old) => {
          if (!old) return [msg];
          if (old.some((m) => m.id === msg.id)) return old;
          return [...old, msg];
        });
        queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      }
    });
    const unsubTyping = socketService.on('typing', (data: any) => {
      if (data.userId === otherUserId) {
        setIsTyping(true);
        typingLoopRef.current?.stop();
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(typingAnimation, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(typingAnimation, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        );
        typingLoopRef.current = loop;
        loop.start();
      }
    });
    const unsubStopTyping = socketService.on('stopTyping', (data: any) => {
      if (data.userId === otherUserId) {
        setIsTyping(false);
        typingLoopRef.current?.stop();
        typingLoopRef.current = null;
        typingAnimation.setValue(0);
      }
    });
    return () => {
      unsubMsg();
      unsubTyping();
      unsubStopTyping();
      typingLoopRef.current?.stop();
    };
  }, [otherUserId, queryClient, typingAnimation]);

  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    if (otherUserId && text.length > 0) {
      socketService.emit('typing', { recipientId: otherUserId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketService.emit('stopTyping', { recipientId: otherUserId });
      }, 2000);
    } else if (otherUserId) {
      socketService.emit('stopTyping', { recipientId: otherUserId });
    }
  }, [otherUserId]);

  useFocusEffect(
    useCallback(() => {
      if (otherUserId) {
        if (messagesQuery.dataUpdatedAt && Date.now() - messagesQuery.dataUpdatedAt > 3000) {
          messagesQuery.refetch();
        } else if (!messagesQuery.data) {
          messagesQuery.refetch();
        }
      }
    }, [otherUserId]),
  );

  // --- Send with optimistic update ---
  const sendMutation = useMutation({
    mutationFn: (payload: { text: string; attachmentUrl?: string; attachmentType?: string; tempId: string }) =>
      apiService.sendMessage(otherUserId as string, payload.text, payload.attachmentUrl, payload.attachmentType),
    onMutate: (payload) => {
      const optimistic: MessageItem = {
        id: payload.tempId,
        text: payload.text,
        attachmentUrl: payload.attachmentUrl ?? null,
        attachmentType: payload.attachmentType ?? null,
        createdAt: new Date().toISOString(),
        isFromMe: true,
        sending: true,
      };
      queryClient.setQueryData<MessageItem[]>(['messages', 'with', otherUserId], (old) =>
        old ? [...old, optimistic] : [optimistic],
      );
      return { tempId: payload.tempId };
    },
    onSuccess: (data: any, _variables, context) => {
      const tempId = context?.tempId;
      queryClient.setQueryData<MessageItem[]>(['messages', 'with', otherUserId], (old) => {
        if (!old) return old;
        return old.map((m) =>
          m.id === tempId
            ? {
                id: data?.id ?? tempId,
                text: data?.text ?? m.text,
                attachmentUrl: data?.attachmentUrl ?? m.attachmentUrl,
                attachmentType: data?.attachmentType ?? m.attachmentType,
                createdAt: data?.createdAt ?? m.createdAt,
                isFromMe: true,
                sending: false,
                sender: data?.sender,
              }
            : m,
        );
      });
      queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
    },
    onError: (_err, _variables, context) => {
      const tempId = context?.tempId;
      queryClient.setQueryData<MessageItem[]>(['messages', 'with', otherUserId], (old) =>
        old ? old.filter((m) => m.id !== tempId) : old,
      );
    },
  });

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !otherUserId) return;
    const tempId = `temp-${Date.now()}-${++tempIdCounter.current}`;
    setInputText('');
    sendMutation.mutate({ text, tempId });
  }, [inputText, otherUserId, sendMutation]);

  const handlePickAttachment = useCallback(async () => {
    const options = ['Фото', 'Видео', 'Отмена'];
    const doAction = async (choice: string) => {
      if (choice === 'Отмена') return;
      const mediaType = choice === 'Видео' ? (['videos'] as const) : (['images'] as const);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Доступ', 'Нужен доступ к галерее');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType as any,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'photo';
      setUploadingAttachment(true);
      try {
        const { url } = await apiService.uploadFile(asset.uri, type);
        const tempId = `temp-${Date.now()}-${++tempIdCounter.current}`;
        sendMutation.mutate({ text: '', attachmentUrl: url, attachmentType: type, tempId });
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить файл');
      } finally {
        setUploadingAttachment(false);
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        (idx) => doAction(options[idx]),
      );
    } else {
      Alert.alert('Вложение', undefined, [
        { text: 'Фото', onPress: () => doAction('Фото') },
        { text: 'Видео', onPress: () => doAction('Видео') },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  }, [sendMutation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { justifyContent: 'center', alignItems: 'center' },
        errorText: { ...typography.body, marginBottom: spacing.md, color: colors.text },
        backBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
        backBtnText: { ...typography.body, fontWeight: '600', color: colors.primary },
        retryButton: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: 8, backgroundColor: colors.primary },
        retryButtonText: { ...typography.body, fontWeight: '600', color: '#fff' },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.sm,
          paddingBottom: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
        headerBack: { padding: spacing.sm, marginRight: spacing.xs },
        avatarWrap: { marginRight: spacing.sm },
        avatar: {
          width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
          justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background,
        },
        avatarImage: { width: 36, height: 36 },
        headerTitle: { ...typography.body, fontWeight: '600', color: colors.text },
        headerSubtitle: { fontSize: 11, marginTop: 1, color: colors.primary },
        loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
        empty: { paddingVertical: spacing.xxl, alignItems: 'center', justifyContent: 'center', flex: 1 },
        emptyText: { ...typography.caption, color: colors.textTertiary },
        dateHeader: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md, paddingHorizontal: spacing.md },
        dateHeaderLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
        dateHeaderText: { ...typography.captionMuted, fontSize: 11, marginHorizontal: spacing.sm, textTransform: 'capitalize', color: colors.textTertiary },
        bubbleWrap: { marginBottom: spacing.xs, flexDirection: 'row', alignItems: 'flex-end' },
        bubbleWrapLeft: { justifyContent: 'flex-start' },
        bubbleWrapRight: { justifyContent: 'flex-end' },
        avatarSmall: {
          width: 20, height: 20, borderRadius: 10, overflow: 'hidden',
          justifyContent: 'center', alignItems: 'center',
          marginRight: spacing.xs, marginBottom: spacing.xs, backgroundColor: colors.background,
        },
        avatarSmallImage: { width: 20, height: 20 },
        avatarSpacer: { width: 20, marginRight: spacing.xs },
        bubble: {
          maxWidth: '75%', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
          borderRadius: 18, borderWidth: StyleSheet.hairlineWidth,
        },
        bubbleMine: { borderBottomRightRadius: 4, backgroundColor: colors.primary, borderColor: colors.primary },
        bubbleTheirs: { borderBottomLeftRadius: 4, backgroundColor: colors.surface, borderColor: colors.border },
        bubbleText: { ...typography.body, lineHeight: 20 },
        bubbleFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-end' },
        bubbleTime: { ...typography.captionMuted, fontSize: 10 },
        readIcon: { marginLeft: 4 },
        attachmentImage: { width: 200, height: 200, borderRadius: radius.md },
        attachmentVideo: {
          width: 200, height: 150, backgroundColor: '#000', borderRadius: radius.md,
          justifyContent: 'center', alignItems: 'center',
        },
        attachmentVideoLabel: { color: '#fff', fontSize: 11, marginTop: 4 },
        typingContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.background },
        typingBubble: {
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
          borderRadius: 18, borderBottomLeftRadius: 4,
          borderWidth: StyleSheet.hairlineWidth,
          backgroundColor: colors.surface, borderColor: colors.border,
        },
        typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textTertiary },
        inputRow: {
          flexDirection: 'row', alignItems: 'flex-end',
          paddingHorizontal: spacing.md, paddingTop: spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
          backgroundColor: colors.surface, borderTopColor: colors.border,
        },
        inputWrapper: {
          flex: 1, flexDirection: 'row', alignItems: 'center',
          borderRadius: 24, borderWidth: StyleSheet.hairlineWidth,
          paddingHorizontal: spacing.md, minHeight: 44, maxHeight: 120,
          backgroundColor: colors.background, borderColor: colors.border,
        },
        input: { flex: 1, paddingVertical: spacing.sm, ...typography.body, maxHeight: 100, color: colors.text },
        inputClear: { padding: spacing.xs, marginLeft: spacing.xs },
        sendBtn: {
          width: 44, height: 44, borderRadius: 22,
          justifyContent: 'center', alignItems: 'center',
        },
      }),
    [colors],
  );

  const renderMessage = useCallback(
    ({ item, index }: { item: MessageItem; index: number }) => {
      const nextMsg = index < invertedMessages.length - 1 ? invertedMessages[index + 1] : null;
      const showDateHeader = shouldShowDateHeader(item.createdAt, nextMsg?.createdAt ?? null);
      const showAvatar = !item.isFromMe && (nextMsg === null || nextMsg.isFromMe || nextMsg.sender?.id !== item.sender?.id);

      return (
        <View>
          <View
            style={[
              styles.bubbleWrap,
              item.isFromMe ? styles.bubbleWrapRight : styles.bubbleWrapLeft,
            ]}
          >
            {!item.isFromMe && showAvatar && (
              <View style={styles.avatarSmall}>
                {item.sender?.avatarUrl ? (
                  <SmartImage uri={item.sender.avatarUrl} style={styles.avatarSmallImage} />
                ) : (
                  <Ionicons name="person" size={14} color={colors.textTertiary} />
                )}
              </View>
            )}
            {!item.isFromMe && !showAvatar && <View style={styles.avatarSpacer} />}
            <View
              style={[
                styles.bubble,
                item.isFromMe ? styles.bubbleMine : styles.bubbleTheirs,
                item.attachmentUrl ? { paddingHorizontal: 4, paddingTop: 4 } : undefined,
                item.sending ? { opacity: 0.7 } : undefined,
              ]}
            >
              {item.attachmentUrl ? (
                <View style={{ borderRadius: radius.md, overflow: 'hidden', marginBottom: item.text ? spacing.xs : 0 }}>
                  {item.attachmentType === 'video' ? (
                    <View style={styles.attachmentVideo}>
                      <Ionicons name="play-circle" size={40} color="#fff" />
                      <Text style={styles.attachmentVideoLabel}>Видео</Text>
                    </View>
                  ) : (
                    <SmartImage uri={item.attachmentUrl} style={styles.attachmentImage} />
                  )}
                </View>
              ) : null}
              {item.text ? (
                <Text
                  style={[
                    styles.bubbleText,
                    { color: item.isFromMe ? '#fff' : colors.text },
                    item.attachmentUrl ? { paddingHorizontal: spacing.sm - 4 } : undefined,
                  ]}
                >
                  {item.text}
                </Text>
              ) : null}
              <View style={[styles.bubbleFooter, item.attachmentUrl ? { paddingHorizontal: spacing.sm - 4 } : undefined]}>
                <Text
                  style={[
                    styles.bubbleTime,
                    { color: item.isFromMe ? 'rgba(255,255,255,0.75)' : colors.textTertiary },
                  ]}
                >
                  {formatTime(item.createdAt)}
                </Text>
                {item.isFromMe && (
                  <Ionicons
                    name={item.sending ? 'time-outline' : 'checkmark-done'}
                    size={12}
                    color="rgba(255,255,255,0.75)"
                    style={styles.readIcon}
                  />
                )}
              </View>
            </View>
          </View>
          {showDateHeader && (
            <View style={styles.dateHeader}>
              <View style={styles.dateHeaderLine} />
              <Text style={styles.dateHeaderText}>{formatDate(item.createdAt)}</Text>
              <View style={styles.dateHeaderLine} />
            </View>
          )}
        </View>
      );
    },
    [colors, invertedMessages, styles],
  );

  // --- Error / loading states ---
  if (!otherUserId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Выберите диалог</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (userQuery.isError && !userQuery.isFetching && !otherUser) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Не удалось загрузить чат</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => userQuery.refetch()} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { marginTop: spacing.sm }]}>
          <Text style={styles.backBtnText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const username = otherUser?.username ?? '…';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {otherUser?.avatarUrl ? (
              <SmartImage uri={otherUser.avatarUrl} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={24} color={colors.textTertiary} />
            )}
          </View>
        </View>
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => otherUserId && (navigation as any).push('Profile', { userId: otherUserId })}
          activeOpacity={0.7}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>{username}</Text>
          {isTyping && <Text style={styles.headerSubtitle}>печатает...</Text>}
        </TouchableOpacity>
      </View>

      {messagesQuery.isError && rawMessages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Не удалось загрузить сообщения</Text>
          <TouchableOpacity style={[styles.retryButton, { marginTop: spacing.md }]} onPress={() => messagesQuery.refetch()} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : messagesQuery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={invertedMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={20}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { marginTop: spacing.md }]}>Напишите первым</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {isTyping && (
        <View style={styles.typingContainer}>
          <View style={styles.typingBubble}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.typingDot,
                  i > 0 && { marginLeft: spacing.xs },
                  {
                    opacity: typingAnimation.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.3, 1, 0.3],
                    }),
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      <View style={[styles.inputRow, { paddingBottom: keyboardVisible ? spacing.sm : Math.max(insets.bottom, spacing.sm) }]}>
        <TouchableOpacity
          onPress={handlePickAttachment}
          style={{ padding: spacing.sm }}
          activeOpacity={0.7}
          disabled={uploadingAttachment}
        >
          {uploadingAttachment ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="attach" size={24} color={colors.primary} />
          )}
        </TouchableOpacity>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Сообщение"
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={4000}
          />
          {inputText.trim() ? (
            <TouchableOpacity
              onPress={() => setInputText('')}
              style={styles.inputClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: inputText.trim() ? colors.primary : colors.border },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim()}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
