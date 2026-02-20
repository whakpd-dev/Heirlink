import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors as themeColors, spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { socketService } from '../../services/socketService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SmartImage } from '../../components/SmartImage';

type ChatThreadParams = { userId: string };

interface MessageItem {
  id: string;
  text: string;
  createdAt: string;
  isFromMe: boolean;
  sender?: { id: string; username: string; avatarUrl: string | null };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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

function shouldShowDateHeader(current: string, previous: string | null): boolean {
  if (!previous) return true;
  const currDate = new Date(current).toDateString();
  const prevDate = new Date(previous).toDateString();
  return currDate !== prevDate;
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
  const otherUserId = (paramFromRoute ?? paramFromNavState) != null ? String(paramFromRoute ?? paramFromNavState).trim() : undefined;
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingAnimation = useRef(new Animated.Value(0)).current;

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
    staleTime: 3000, // Данные считаются свежими 3 секунды
    gcTime: 300000, // Кэш хранится 5 минут
    retry: 1,
  });

  useEffect(() => {
    if (!otherUserId) return;
    const unsubMsg = socketService.on('newMessage', (msg: any) => {
      if (msg.senderId === otherUserId || msg.recipientId === otherUserId) {
        queryClient.setQueryData<MessageItem[]>(['messages', 'with', otherUserId], (old) => {
          if (!old) return [msg];
          if (old.some((m) => m.id === msg.id)) return old;
          return [...old, msg];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });
    const unsubTyping = socketService.on('typing', (data: any) => {
      if (data.userId === otherUserId) {
        setIsTyping(true);
        Animated.loop(
          Animated.sequence([
            Animated.timing(typingAnimation, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(typingAnimation, { toValue: 0, duration: 600, useNativeDriver: true }),
          ])
        ).start();
      }
    });
    const unsubStopTyping = socketService.on('stopTyping', (data: any) => {
      if (data.userId === otherUserId) {
        setIsTyping(false);
        typingAnimation.setValue(0);
      }
    });
    return () => { unsubMsg(); unsubTyping(); unsubStopTyping(); };
  }, [otherUserId, queryClient]);

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
        // Обновляем только если данные устарели (прошло больше 3 секунд)
        if (messagesQuery.dataUpdatedAt && Date.now() - messagesQuery.dataUpdatedAt > 3000) {
          messagesQuery.refetch();
        } else if (!messagesQuery.data) {
          // Если данных нет, загружаем
          messagesQuery.refetch();
        }
      }
    }, [otherUserId, messagesQuery]),
  );

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      apiService.sendMessage(otherUserId as string, text),
    onSuccess: (data: any) => {
      const newMsg: MessageItem = {
        id: data?.id ?? `temp-${Date.now()}`,
        text: data?.text ?? '',
        createdAt: data?.createdAt ?? new Date().toISOString(),
        isFromMe: true,
        sender: data?.sender,
      };
      queryClient.setQueryData<MessageItem[]>(['messages', 'with', otherUserId], (old) =>
        old ? [...old, newMsg] : [newMsg],
      );
      queryClient.invalidateQueries({ queryKey: ['messages', 'with', otherUserId] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'conversations'] });
    },
  });

  const messages = (messagesQuery.data ?? []) as MessageItem[];

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || sendMutation.isPending || !otherUserId) return;
    setInputText('');
    sendMutation.mutate(text);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 200);
  }, [inputText, sendMutation, otherUserId]);

  const renderMessage = useCallback(
    ({ item, index }: { item: MessageItem; index: number }) => {
      const prevMsg = index > 0 ? messages[index - 1] : null;
      const showDateHeader = shouldShowDateHeader(item.createdAt, prevMsg?.createdAt ?? null);
      const showAvatar = !item.isFromMe && (prevMsg === null || prevMsg.isFromMe || prevMsg.sender?.id !== item.sender?.id);
      
      return (
        <View>
          {showDateHeader && (
            <View style={styles.dateHeader}>
              <View style={[styles.dateHeaderLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dateHeaderText, { color: colors.textTertiary }]}>
                {formatDate(item.createdAt)}
              </Text>
              <View style={[styles.dateHeaderLine, { backgroundColor: colors.border }]} />
            </View>
          )}
          <View
            style={[
              styles.bubbleWrap,
              item.isFromMe ? styles.bubbleWrapRight : styles.bubbleWrapLeft,
            ]}
          >
            {!item.isFromMe && showAvatar && (
              <View style={[styles.avatarSmall, { backgroundColor: colors.background }]}>
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
                item.isFromMe
                  ? [styles.bubbleMine, { 
                      backgroundColor: colors.primary,
                      shadowColor: colors.primary,
                    }]
                  : [styles.bubbleTheirs, { 
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      shadowColor: colors.shadow,
                    }],
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  { color: item.isFromMe ? '#fff' : colors.text },
                ]}
              >
                {item.text}
              </Text>
              <View style={styles.bubbleFooter}>
                <Text
                  style={[
                    styles.bubbleTime,
                    { color: item.isFromMe ? 'rgba(255,255,255,0.75)' : colors.textTertiary },
                  ]}
                >
                  {formatTime(item.createdAt)}
                </Text>
                {item.isFromMe && (
                  <Ionicons name="checkmark-done" size={12} color="rgba(255,255,255,0.75)" style={styles.readIcon} />
                )}
              </View>
            </View>
          </View>
        </View>
      );
    },
    [colors, messages],
  );

  if (!otherUserId) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Выберите диалог</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (userQuery.isError && !userQuery.isFetching && !otherUser) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.text }]}>Не удалось загрузить чат</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => userQuery.refetch()} activeOpacity={0.8}>
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { marginTop: spacing.sm }]}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const username = otherUser?.username ?? '…';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: colors.background }]}>
            {otherUser?.avatarUrl ? (
              <SmartImage uri={otherUser.avatarUrl} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={24} color={colors.textTertiary} />
            )}
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {username}
          </Text>
          {isTyping && (
            <Text style={[styles.headerSubtitle, { color: colors.primary }]}>печатает...</Text>
          )}
        </View>
      </View>

      {messagesQuery.isError && messages.length === 0 ? (
        <View style={[styles.empty, { flex: 1, justifyContent: 'center' }]}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Не удалось загрузить сообщения</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: spacing.md }]} onPress={() => messagesQuery.refetch()} activeOpacity={0.8}>
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
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => renderMessage({ item, index })}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary, marginTop: spacing.md }]}>
                Напишите первым
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
          }}
        />
      )}

      {isTyping && (
        <View style={[styles.typingContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Animated.View
              style={[
                styles.typingDot,
                {
                  backgroundColor: colors.textTertiary,
                  opacity: typingAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.typingDot,
                {
                  backgroundColor: colors.textTertiary,
                  opacity: typingAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }),
                },
                { marginLeft: spacing.xs },
              ]}
            />
            <Animated.View
              style={[
                styles.typingDot,
                {
                  backgroundColor: colors.textTertiary,
                  opacity: typingAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }),
                },
                { marginLeft: spacing.xs },
              ]}
            />
          </View>
        </View>
      )}

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + spacing.sm,
            paddingTop: spacing.sm,
          },
        ]}
      >
        <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
              },
            ]}
            placeholder="Сообщение"
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={4000}
            editable={!sendMutation.isPending}
          />
          {inputText.trim() && (
            <TouchableOpacity
              onPress={() => setInputText('')}
              style={styles.inputClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: inputText.trim() ? colors.primary : colors.border,
              shadowColor: inputText.trim() ? colors.primary : 'transparent',
            },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sendMutation.isPending}
          activeOpacity={0.8}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  backBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  backBtnText: {
    ...typography.body,
    fontWeight: '600',
  },
  retryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
  },
  retryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  avatarWrap: {
    marginRight: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  empty: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyText: {
    ...typography.caption,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dateHeaderLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dateHeaderText: {
    ...typography.captionMuted,
    fontSize: 11,
    marginHorizontal: spacing.sm,
    textTransform: 'capitalize',
  },
  bubbleWrap: {
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bubbleWrapLeft: {
    justifyContent: 'flex-start',
  },
  bubbleWrapRight: {
    justifyContent: 'flex-end',
  },
  avatarSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  avatarSmallImage: {
    width: 20,
    height: 20,
  },
  avatarSpacer: {
    width: 20,
    marginRight: spacing.xs,
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    ...typography.body,
    lineHeight: 20,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  bubbleTime: {
    ...typography.captionMuted,
    fontSize: 10,
  },
  readIcon: {
    marginLeft: 4,
  },
  typingContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
    maxHeight: 100,
  },
  inputClear: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});
