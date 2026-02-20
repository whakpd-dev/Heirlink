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
      if (data.userId === otherUserId) setIsTyping(true);
    });
    const unsubStopTyping = socketService.on('stopTyping', (data: any) => {
      if (data.userId === otherUserId) setIsTyping(false);
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
      if (otherUserId) messagesQuery.refetch();
    }, [otherUserId]),
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
    ({ item }: { item: MessageItem }) => (
      <View
        style={[
          styles.bubbleWrap,
          item.isFromMe ? styles.bubbleWrapRight : styles.bubbleWrapLeft,
        ]}
      >
        <View
          style={[
            styles.bubble,
            item.isFromMe
              ? [styles.bubbleMine, { backgroundColor: colors.primary }]
              : [styles.bubbleTheirs, { backgroundColor: colors.surface, borderColor: colors.border }],
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
          <Text
            style={[
              styles.bubbleTime,
              { color: item.isFromMe ? 'rgba(255,255,255,0.7)' : colors.textTertiary },
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    ),
    [colors],
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
          renderItem={renderMessage}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                Напишите первым
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {isTyping && (
        <View style={[styles.typingRow, { backgroundColor: colors.surface }]}>
          <Text style={[styles.typingText, { color: colors.textTertiary }]}>
            {otherUser?.username ?? 'Собеседник'} печатает...
          </Text>
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
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border,
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
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: inputText.trim() ? colors.primary : colors.border,
            },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sendMutation.isPending}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={20} color="#fff" />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  empty: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.caption,
  },
  bubbleWrap: {
    marginBottom: spacing.sm,
  },
  bubbleWrapLeft: {
    alignItems: 'flex-start',
  },
  bubbleWrapRight: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleMine: {
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    ...typography.body,
  },
  bubbleTime: {
    ...typography.captionMuted,
    fontSize: 10,
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  typingRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
  },
  typingText: {
    ...typography.caption,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
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
});
