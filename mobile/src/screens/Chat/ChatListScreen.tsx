import React, { useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';
import { apiService } from '../../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SmartImage } from '../../components/SmartImage';
import { socketService } from '../../services/socketService';

interface ConversationItem {
  otherUser: { id: string; username: string; avatarUrl: string | null };
  lastMessage: string;
  lastMessageAttachmentType?: string | null;
  lastAt: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин`;
  if (diffH < 24) return `${diffH} ч`;
  if (diffD < 7) return `${diffD} д`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function previewText(item: ConversationItem): string {
  if (item.lastMessage) return item.lastMessage;
  if (item.lastMessageAttachmentType === 'video') return '🎬 Видео';
  if (item.lastMessageAttachmentType === 'photo') return '📷 Фото';
  if (item.lastMessageAttachmentType) return '📎 Вложение';
  return 'Нет сообщений';
}

export const ChatListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: async () => {
      const res = await apiService.getConversations(1, 100);
      return (res?.items ?? []) as ConversationItem[];
    },
    retry: 1,
    staleTime: 5000,
    gcTime: 300000,
  });

  // Real-time: listen for new messages and bump conversation to top
  useEffect(() => {
    const unsub = socketService.on('newMessage', (msg: any) => {
      queryClient.setQueryData<ConversationItem[]>(['messages', 'conversations'], (old) => {
        if (!old) return old;
        const otherUserId = msg.isFromMe ? msg.recipientId : msg.senderId;
        const otherUsername = msg.isFromMe
          ? msg.recipient?.username
          : msg.sender?.username;
        const otherAvatarUrl = msg.isFromMe
          ? msg.recipient?.avatarUrl
          : msg.sender?.avatarUrl;
        const existingIdx = old.findIndex((c) => c.otherUser.id === otherUserId);

        const updated: ConversationItem = existingIdx >= 0
          ? {
              ...old[existingIdx],
              lastMessage: msg.text || '',
              lastMessageAttachmentType: msg.attachmentType,
              lastAt: msg.createdAt || new Date().toISOString(),
            }
          : {
              otherUser: {
                id: otherUserId,
                username: otherUsername || '?',
                avatarUrl: otherAvatarUrl ?? null,
              },
              lastMessage: msg.text || '',
              lastMessageAttachmentType: msg.attachmentType,
              lastAt: msg.createdAt || new Date().toISOString(),
            };

        const rest = existingIdx >= 0
          ? [...old.slice(0, existingIdx), ...old.slice(existingIdx + 1)]
          : [...old];
        return [updated, ...rest];
      });
    });
    return unsub;
  }, [queryClient]);

  useFocusEffect(
    useCallback(() => {
      if (query.dataUpdatedAt && Date.now() - query.dataUpdatedAt > 5000) {
        query.refetch();
      } else if (!query.data) {
        query.refetch();
      }
    }, [query]),
  );

  const openChat = useCallback(
    (userId: string) => {
      (navigation as any).push('ChatThread', { userId });
    },
    [navigation],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
        title: { ...typography.title, color: colors.text },
        loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
        emptyText: { ...typography.body, marginTop: spacing.md, color: colors.textTertiary },
        emptyHint: { ...typography.caption, marginTop: spacing.xs, color: colors.textTertiary },
        retryButton: { marginTop: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: 8, backgroundColor: colors.primary },
        retryButtonText: { ...typography.body, fontWeight: '600', color: '#fff' },
        row: {
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border, backgroundColor: colors.surface,
        },
        avatarContainer: { position: 'relative', marginRight: spacing.md },
        avatar: {
          width: 56, height: 56, borderRadius: 28, overflow: 'hidden',
          justifyContent: 'center', alignItems: 'center',
          borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.background,
        },
        avatarImage: { width: 56, height: 56 },
        body: { flex: 1, minWidth: 0 },
        bodyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
        username: { ...typography.body, fontWeight: '600', flex: 1, marginRight: spacing.sm, color: colors.text },
        preview: { ...typography.caption, lineHeight: 18, color: colors.textSecondary },
        time: { ...typography.captionMuted, fontSize: 12 },
      }),
    [colors],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<ConversationItem> | null | undefined, index: number) => ({
      length: 72,
      offset: 72 * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: ConversationItem }) => {
      const isRecent = isToday(item.lastAt);
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => openChat(item.otherUser.id)}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {item.otherUser.avatarUrl ? (
                <SmartImage uri={item.otherUser.avatarUrl} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={28} color={colors.textTertiary} />
              )}
            </View>
          </View>
          <View style={styles.body}>
            <View style={styles.bodyHeader}>
              <Text style={styles.username} numberOfLines={1}>
                {item.otherUser.username}
              </Text>
              <Text
                style={[
                  styles.time,
                  {
                    color: isRecent ? colors.primary : colors.textTertiary,
                    fontWeight: isRecent ? '600' : '400',
                  },
                ]}
              >
                {formatTime(item.lastAt)}
              </Text>
            </View>
            <Text style={styles.preview} numberOfLines={1}>
              {previewText(item)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, openChat, styles],
  );

  const list = query.data ?? [];
  const isLoading = query.isLoading && list.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Чаты</Text>
      </View>
      {query.isError && list.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Не удалось загрузить чаты</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => query.refetch()} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.otherUser.id}
          renderItem={renderItem}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={10}
          getItemLayout={getItemLayout}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && list.length > 0}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
              <Text style={styles.emptyText}>Пока нет диалогов</Text>
              <Text style={styles.emptyHint}>Напишите пользователю из профиля или поиска</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};
