import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const TABS = [
  { key: 'all', label: 'Все', icon: 'notifications-outline' },
  { key: 'likes', label: 'Лайки', icon: 'heart-outline' },
  { key: 'comments', label: 'Комментарии', icon: 'chatbubble-outline' },
  { key: 'follows', label: 'Подписки', icon: 'person-add-outline' },
];

type NotificationType = 'like' | 'comment' | 'follow' | 'comment_reply';

interface NotificationItem {
  id: string;
  type: NotificationType;
  actor: { id: string; username: string; avatarUrl: string | null };
  postId?: string;
  commentId?: string;
  read: boolean;
  createdAt: string;
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

function getNotificationText(type: NotificationType): string {
  switch (type) {
    case 'like':
      return 'лайкнул(а) ваш пост';
    case 'comment':
      return 'прокомментировал(а) ваш пост';
    case 'comment_reply':
      return 'ответил(а) на ваш комментарий';
    case 'follow':
      return 'подписался(ась) на вас';
    default:
      return '';
  }
}

/**
 * Экран активности и уведомлений (интеграция с API /notifications)
 */
export const ActivityScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [markingAll, setMarkingAll] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiService.getNotifications(1, 50);
      return (res?.items ?? []).map((n: any) => ({
        id: n.id,
        type: n.type,
        actor: n.actor ?? { id: '', username: '?', avatarUrl: null },
        postId: n.postId,
        commentId: n.commentId,
        read: n.read ?? false,
        createdAt: n.createdAt ?? '',
      })) as NotificationItem[];
    },
    staleTime: 30_000,
  });

  const onRefresh = useCallback(() => {
    notificationsQuery.refetch();
  }, [notificationsQuery]);

  const onMarkAllRead = useCallback(async () => {
    try {
      setMarkingAll(true);
      await apiService.markAllNotificationsRead();
      queryClient.setQueryData<NotificationItem[]>(['notifications'], (prev) =>
        (prev ?? []).map((n) => ({ ...n, read: true })),
      );
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  }, [queryClient]);

  const typeByTab: Record<string, NotificationType> = {
    likes: 'like',
    comments: 'comment',
    follows: 'follow',
  };
  const items = notificationsQuery.data ?? [];
  const filtered =
    activeTab === 'all'
      ? items
      : items.filter((n) => n.type === typeByTab[activeTab] || (activeTab === 'comments' && n.type === 'comment_reply'));

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'like':
        return <Ionicons name="heart" size={20} color={colors.like} />;
      case 'comment':
      case 'comment_reply':
        return <Ionicons name="chatbubble" size={20} color={colors.primary} />;
      case 'follow':
        return <Ionicons name="person-add" size={20} color={colors.accent} />;
      default:
        return <Ionicons name="notifications" size={20} color={colors.textTertiary} />;
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backButton: {
          width: 40,
          height: 40,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.xs,
        },
        title: {
          ...typography.title,
          color: colors.text,
          flex: 1,
        },
        markAllBtn: {
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
        },
        markAllText: {
          ...typography.caption,
          color: colors.primary,
          fontWeight: '600',
        },
        loading: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 80,
        },
        tabsScroll: {
          maxHeight: 52,
          backgroundColor: colors.surface,
        },
        tabsContent: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        },
        tab: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: colors.background,
          marginRight: spacing.sm,
          gap: spacing.xs,
        },
        tabActive: {
          backgroundColor: colors.text,
        },
        tabLabel: {
          ...typography.caption,
          color: colors.textSecondary,
        },
        tabLabelActive: {
          color: colors.surface,
          fontWeight: '600',
        },
        list: {
          flex: 1,
        },
        listContent: {
          paddingTop: spacing.sm,
        },
        empty: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 80,
        },
        emptyText: {
          ...typography.body,
          color: colors.textTertiary,
          marginTop: spacing.md,
        },
        notificationItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          marginBottom: StyleSheet.hairlineWidth,
        },
        notificationItemUnread: {
          backgroundColor: colors.background,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
        },
        notificationIcon: {
          position: 'absolute',
          left: spacing.lg + 32,
          top: spacing.md + 28,
        },
        notificationBody: {
          flex: 1,
          marginLeft: spacing.sm,
        },
        notificationText: {
          ...typography.body,
          color: colors.text,
        },
        notificationUser: {
          fontWeight: '600',
        },
        notificationTime: {
          ...typography.captionMuted,
          color: colors.textTertiary,
          marginTop: 2,
        },
        preview: {
          width: 44,
          height: 44,
          borderRadius: radius.sm,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [colors],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Активность</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={onMarkAllRead}
            disabled={markingAll}
            style={styles.markAllBtn}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.markAllText}>Прочитать все</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.key ? colors.text : colors.textTertiary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {notificationsQuery.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={7}
          initialNumToRender={10}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl
              refreshing={notificationsQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>Пока ничего нет</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notificationItem, !item.read && styles.notificationItemUnread]}
              activeOpacity={0.8}
              onPress={() => {
                if (item.postId != null) {
                  (navigation as any).push('PostDetail', {
                    postId: String(item.postId),
                  });
                } else if (item.actor?.id) {
                  (navigation as any).push('Profile', {
                    userId: item.actor.id,
                  });
                }
              }}
            >
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={colors.textTertiary} />
              </View>
              <View style={styles.notificationIcon}>{getIcon(item.type)}</View>
              <View style={styles.notificationBody}>
                <Text style={styles.notificationText}>
                  <Text style={styles.notificationUser}>{item.actor?.username ?? '?'}</Text>
                  {' ' + getNotificationText(item.type)}
                </Text>
                <Text style={styles.notificationTime}>{formatTime(item.createdAt)}</Text>
              </View>
              {item.postId != null && (
                <View style={styles.preview}>
                  <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
                </View>
              )}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};
