import React, { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeedHeader } from '../../components/FeedHeader';
import { StoriesRail } from '../../components/StoriesRail';
import { PostCard } from '../../components/PostCard';
import { apiService } from '../../services/api';
import { Post } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';
import { useInfiniteQuery } from '@tanstack/react-query';

/**
 * Экран ленты — данные с API getFeed (посты от подписок)
 */
export const FeedScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const limit = 10;
  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', limit],
    queryFn: async ({ pageParam = 1 }) => apiService.getFeed(pageParam, limit),
    getNextPageParam: (lastPage: any) => {
      if (!lastPage || !lastPage.pagination) return undefined;
      const page = lastPage.pagination.page ?? 1;
      const totalPages = lastPage.pagination.totalPages ?? 1;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const posts = useMemo(() => {
    const pages = feedQuery.data?.pages ?? [];
    return pages.flatMap((res: any) =>
      (res?.posts ?? []).map((p: any) => ({
        id: p.id,
        userId: p.userId,
        user: p.user ?? { id: p.userId, username: '?', avatarUrl: undefined },
        caption: p.caption,
        location: p.location,
        media: p.media ?? [],
        likesCount: p.likesCount ?? 0,
        commentsCount: p.commentsCount ?? 0,
        isLiked: p.isLiked ?? false,
        isSaved: p.isSaved ?? false,
        createdAt: p.createdAt ?? '',
      })),
    );
  }, [feedQuery.data]);

  const onRefresh = useCallback(() => {
    feedQuery.refetch();
  }, [feedQuery]);

  const loadMore = useCallback(() => {
    if (!feedQuery.hasNextPage || feedQuery.isFetchingNextPage) return;
    feedQuery.fetchNextPage();
  }, [feedQuery]);

  const renderItem = useCallback(({ item }: { item: Post }) => (
    <PostCard post={item} />
  ), []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollContent: {
          paddingBottom: 24,
        },
        loading: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 80,
        },
        feed: {
          paddingTop: 8,
        },
        empty: {
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.xxl,
          alignItems: 'center',
        },
        emptyText: {
          ...typography.body,
          color: colors.textSecondary,
          textAlign: 'center',
        },
        errorContainer: {
          flex: 1,
          justifyContent: 'center',
          paddingTop: 80,
        },
        retryButton: {
          marginTop: spacing.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xl,
          borderRadius: 8,
          alignSelf: 'center',
        },
        retryButtonText: {
          ...typography.body,
          fontWeight: '600',
          color: '#fff',
        },
        loadingMore: {
          paddingVertical: spacing.lg,
          alignItems: 'center',
        },
      }),
    [colors],
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.background === '#0F0F0F' ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} translucent={false} />
      <FeedHeader />
      {feedQuery.isLoading && posts.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : feedQuery.isError && posts.length === 0 ? (
        <View style={[styles.empty, styles.errorContainer]}>
          <Text style={[styles.emptyText, { color: colors.text }]}>Не удалось загрузить ленту</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => feedQuery.refetch()} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          windowSize={5}
          initialNumToRender={3}
          ListHeaderComponent={<StoriesRail />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Подпишитесь на пользователей, чтобы видеть их посты в ленте</Text>
            </View>
          }
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={feedQuery.isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            feedQuery.isFetchingNextPage ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};
