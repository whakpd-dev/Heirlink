import React, { useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors as themeColors, spacing, typography } from '../../theme';
import { apiService } from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import { SmartImage } from '../../components/SmartImage';

interface ConversationItem {
  otherUser: { id: string; username: string; avatarUrl: string | null };
  lastMessage: string;
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
  return d.toLocaleDateString();
}

export const ChatListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const query = useQuery({
    queryKey: ['messages', 'conversations'],
    queryFn: async () => {
      const res = await apiService.getConversations(1, 100);
      return (res?.items ?? []) as ConversationItem[];
    },
    retry: 1,
  });

  const onRefresh = useCallback(() => {
    query.refetch();
  }, [query]);

  const openChat = useCallback(
    (userId: string) => {
      (navigation as any).push('ChatThread', { userId });
    },
    [navigation],
  );

  const list = query.data ?? [];
  const isLoading = query.isLoading && list.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Чаты</Text>
      </View>
      {query.isError && list.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            Не удалось загрузить чаты
          </Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => query.refetch()} activeOpacity={0.8}>
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
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && list.length > 0}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                Пока нет диалогов
              </Text>
              <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>
                Напишите пользователю из профиля или поиска
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.surface }]}
              activeOpacity={0.7}
              onPress={() => openChat(item.otherUser.id)}
            >
              <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                {item.otherUser.avatarUrl ? (
                  <SmartImage uri={item.otherUser.avatarUrl} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={28} color={colors.textTertiary} />
                )}
              </View>
              <View style={styles.body}>
                <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                  {item.otherUser.username}
                </Text>
                <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              <Text style={[styles.time, { color: colors.textTertiary }]}>
                {formatTime(item.lastAt)}
              </Text>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    ...typography.title,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    ...typography.body,
    marginTop: spacing.md,
  },
  emptyHint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
  },
  retryButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 52,
    height: 52,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    ...typography.body,
    fontWeight: '600',
  },
  preview: {
    ...typography.caption,
    marginTop: 2,
  },
  time: {
    ...typography.captionMuted,
    marginLeft: spacing.sm,
  },
});
