import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SmartImage } from '../../components/SmartImage';

const TABS = [
  { key: 'users', label: 'Люди' },
  { key: 'posts', label: 'Посты' },
];
const GRID_GAP = 2;
const COLS = 3;
const DEBOUNCE_MS = 400;

interface UserHit {
  id: string;
  username: string;
  avatarUrl: string | null;
  followersCount: number;
  isFollowing?: boolean;
}

interface PostHit {
  id: string;
  user?: { id: string; username: string; avatarUrl?: string | null };
  media?: { url: string; type: string }[];
  likesCount?: number;
  commentsCount?: number;
}

/**
 * Экран поиска: поиск пользователей/постов (debounce), блок рекомендаций (getSuggestions)
 */
export const ExploreScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        searchSection: {
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        searchBar: {
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        },
        searchInput: {
          flex: 1,
          ...typography.body,
          fontSize: 14,
          padding: 0,
        },
        tabsRow: {
          flexDirection: 'row',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: colors.surface,
          gap: spacing.sm,
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        },
        loading: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 48,
        },
        empty: {
          paddingVertical: spacing.xxl,
          alignItems: 'center',
        },
        emptyText: {
          ...typography.body,
          color: colors.textSecondary,
        },
        suggestionsBlock: {
          paddingHorizontal: spacing.lg,
        },
        suggestionsTitle: {
          ...typography.bodyBold,
          color: colors.text,
          marginBottom: spacing.md,
        },
        suggestionsLoader: {
          marginVertical: spacing.lg,
        },
        userRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        userAvatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: spacing.md,
          overflow: 'hidden',
        },
        userAvatarImg: {
          width: 48,
          height: 48,
          borderRadius: 24,
        },
        userInfo: {
          flex: 1,
        },
        userName: {
          ...typography.bodyBold,
          color: colors.text,
        },
        userMeta: {
          ...typography.captionMuted,
          color: colors.textTertiary,
          marginTop: 2,
        },
        followBtn: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.sm,
          backgroundColor: colors.primary,
        },
        followBtnActive: {
          backgroundColor: colors.background,
        },
        followBtnText: {
          ...typography.caption,
          fontWeight: '600',
          color: colors.surface,
        },
        followBtnTextActive: {
          color: colors.textSecondary,
        },
        chip: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: colors.background,
          marginRight: spacing.sm,
        },
        chipActive: {
          backgroundColor: colors.text,
        },
        chipText: {
          ...typography.caption,
          color: colors.textSecondary,
        },
        chipTextActive: {
          color: colors.surface,
          fontWeight: '600',
        },
        grid: {
          padding: GRID_GAP / 2,
        },
        gridRow: {
          gap: GRID_GAP,
          marginBottom: GRID_GAP,
        },
        gridItem: {
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        gridImage: {
          width: '100%',
          height: '100%',
        },
        gridPlaceholder: {
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        },
        gridOverlay: {
          position: 'absolute',
          bottom: spacing.xs,
          right: spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        gridLikes: {
          ...typography.label,
          color: colors.surface,
        },
      }),
    [colors],
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'posts'>('users');
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemSize = (width - GRID_GAP * (COLS - 1)) / COLS;
  const hasQuery = searchQuery.trim().length > 0;
  const hasDebouncedQuery = debouncedQuery.trim().length > 0;

  // Обновляем debouncedQuery только после паузы в вводе — тогда не дергается экран при каждой букве
  useEffect(() => {
    const q = searchQuery.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q) {
      setDebouncedQuery('');
      return;
    }
    debounceRef.current = setTimeout(() => setDebouncedQuery(q), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const suggestionsQuery = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const res = await apiService.getSuggestions(15);
      return (res?.items ?? []).map((u: any) => ({
        id: u.id,
        username: u.username ?? '?',
        avatarUrl: u.avatarUrl ?? null,
        followersCount: u.followersCount ?? 0,
        isFollowing: u.isFollowing,
      })) as UserHit[];
    },
    staleTime: 60_000,
  });

  const searchQueryData = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async () => {
      const query = debouncedQuery.trim();
      const [usersRes, postsRes] = await Promise.all([
        apiService.searchUsers(query, 1, 20),
        apiService.searchPosts(query, 1, 30),
      ]);
      const users = (usersRes?.items ?? []).map((u: any) => ({
        id: u.id,
        username: u.username ?? '?',
        avatarUrl: u.avatarUrl ?? null,
        followersCount: u.followersCount ?? 0,
        isFollowing: u.isFollowing,
      })) as UserHit[];
      const posts = (postsRes?.posts ?? []).map((p: any) => ({
        id: p.id,
        user: p.user,
        media: p.media ?? [],
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
      })) as PostHit[];
      return { users, posts };
    },
    enabled: hasDebouncedQuery,
    staleTime: 30_000,
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => apiService.followUser(userId),
    onSuccess: (_res, userId) => {
      queryClient.setQueryData<UserHit[]>(['suggestions'], (prev) =>
        (prev ?? []).map((u) => (u.id === userId ? { ...u, isFollowing: true } : u)),
      );
      queryClient.setQueryData<{ users: UserHit[]; posts: PostHit[] }>(
        ['search', debouncedQuery],
        (prev) => prev
          ? {
              ...prev,
              users: prev.users.map((u) => (u.id === userId ? { ...u, isFollowing: true } : u)),
            }
          : prev,
      );
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
  const handleFollow = useCallback((userId: string) => {
    followMutation.mutate(userId);
  }, [followMutation]);

  const users = useMemo(() => (searchQueryData.data?.users ?? []), [searchQueryData.data]);
  const posts = useMemo(() => (searchQueryData.data?.posts ?? []), [searchQueryData.data]);
  const suggestions = suggestionsQuery.data ?? [];
  const loadingSearch = searchQueryData.isFetching;
  const loadingSuggestions = suggestionsQuery.isLoading;

  const renderUserRow = useCallback((item: UserHit) => (
    <TouchableOpacity
      key={item.id}
      style={styles.userRow}
      activeOpacity={0.8}
      onPress={() => {
        if (__DEV__) console.log('[HeirLink Explore:openProfile]', { userId: item.id, username: item.username });
        (navigation as any).push('Profile', { userId: String(item.id) });
      }}
    >
      <View style={styles.userAvatar}>
        {item.avatarUrl ? (
          <SmartImage uri={item.avatarUrl} style={styles.userAvatarImg} />
        ) : (
          <Ionicons name="person" size={24} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.username}</Text>
        <Text style={styles.userMeta}>{item.followersCount} подписчиков</Text>
      </View>
      <TouchableOpacity
        style={[styles.followBtn, item.isFollowing && styles.followBtnActive]}
        onPress={() => !item.isFollowing && handleFollow(item.id)}
        disabled={!!item.isFollowing}
      >
        <Text style={[styles.followBtnText, item.isFollowing && styles.followBtnTextActive]}>
          {item.isFollowing ? 'Подписка' : 'Подписаться'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  ), [navigation, colors, handleFollow]);

  const renderUserItem = useCallback(({ item }: { item: UserHit }) => renderUserRow(item), [renderUserRow]);

  const renderPostItem = useCallback(({ item }: { item: PostHit }) => {
    const firstMedia = item.media?.[0];
    return (
      <TouchableOpacity
        style={[styles.gridItem, { width: itemSize, height: itemSize }]}
        activeOpacity={0.9}
        onPress={() => (navigation as any).push('PostDetail', { postId: String(item.id) })}
      >
        {firstMedia?.url ? (
          <SmartImage uri={firstMedia.url} style={styles.gridImage} />
        ) : (
          <View style={styles.gridPlaceholder}>
            <Ionicons name="image-outline" size={28} color={colors.textTertiary} />
          </View>
        )}
        {(item.likesCount ?? 0) > 0 && (
          <View style={styles.gridOverlay}>
            <Ionicons name="heart" size={14} color={colors.surface} />
            <Text style={styles.gridLikes}>{item.likesCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [navigation, colors, itemSize]);

  const renderSuggestionItem = useCallback(({ item }: { item: UserHit }) => (
    <TouchableOpacity
      style={styles.userRow}
      activeOpacity={0.8}
      onPress={() => {
        if (__DEV__) console.log('[HeirLink Explore:openProfile]', { userId: item.id, username: item.username });
        (navigation as any).push('Profile', { userId: String(item.id) });
      }}
    >
      <View style={styles.userAvatar}>
        {item.avatarUrl ? (
          <SmartImage uri={item.avatarUrl} style={styles.userAvatarImg} />
        ) : (
          <Ionicons name="person" size={24} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.username}</Text>
        <Text style={styles.userMeta}>{item.followersCount} подписчиков</Text>
      </View>
      <TouchableOpacity
        style={styles.followBtn}
        onPress={() => handleFollow(item.id)}
      >
        <Text style={styles.followBtnText}>Подписаться</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  ), [navigation, colors, handleFollow]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.searchSection, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Поиск"
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {hasQuery || hasDebouncedQuery ? (
        <>
          <View style={[styles.tabsRow, { backgroundColor: colors.background }]}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.chip,
                  { backgroundColor: colors.surface },
                  activeTab === tab.key && { backgroundColor: colors.text },
                ]}
                onPress={() => setActiveTab(tab.key as 'users' | 'posts')}
              >
                <Text style={[
                  styles.chipText,
                  { color: colors.textSecondary },
                  activeTab === tab.key && { color: colors.background, fontWeight: '600' },
                ]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {loadingSearch ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : activeTab === 'users' ? (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Никого не найдено</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={posts}
              renderItem={renderPostItem}
              keyExtractor={(item) => item.id}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={5}
              initialNumToRender={6}
              numColumns={COLS}
              key="grid"
              contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 100 }]}
              columnWrapperStyle={styles.gridRow}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>Постов не найдено</Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.id}
          renderItem={renderSuggestionItem}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={6}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          ListHeaderComponent={
            <View style={styles.suggestionsBlock}>
              <Text style={styles.suggestionsTitle}>Рекомендации</Text>
            </View>
          }
          ListEmptyComponent={
            loadingSuggestions ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.suggestionsLoader} />
            ) : (
              <Text style={styles.emptyText}>Пока нет рекомендаций</Text>
            )
          }
        />
      )}
    </View>
  );
};
