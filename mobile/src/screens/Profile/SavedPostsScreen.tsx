import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';
import { apiService } from '../../services/api';
import { SmartImage } from '../../components/SmartImage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 2;
const COLS = 3;
const TILE = (SCREEN_WIDTH - GRID_GAP * (COLS - 1)) / COLS;

export const SavedPostsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const savedQuery = useQuery({
    queryKey: ['savedPosts'],
    queryFn: () => apiService.getSavedPosts(1, 100),
    staleTime: 30_000,
  });

  const posts = useMemo(() => {
    const data = savedQuery.data as any;
    if (Array.isArray(data)) return data;
    if (data?.posts) return data.posts;
    return [];
  }, [savedQuery.data]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backBtn: { width: 40, height: 40, justifyContent: 'center' },
        headerTitle: { ...typography.title, color: colors.text, fontSize: 18, flex: 1, marginLeft: spacing.sm },
        tile: { width: TILE, height: TILE },
        separator: { width: GRID_GAP, height: GRID_GAP },
        emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
        emptyIcon: { marginBottom: spacing.lg },
        emptyTitle: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
        emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
        videoIcon: { position: 'absolute', top: 4, right: 4 },
      }),
    [colors],
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const post = item.post ?? item;
      const firstMedia = post.media?.[0];
      const isVideo = firstMedia?.type === 'video';
      return (
        <TouchableOpacity
          style={styles.tile}
          onPress={() => (navigation as any).push('PostDetail', { postId: String(post.id) })}
          activeOpacity={0.8}
        >
          <SmartImage uri={firstMedia?.url ?? ''} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          {isVideo && (
            <View style={styles.videoIcon}>
              <Ionicons name="videocam" size={16} color="#FFF" />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [styles, navigation],
  );

  if (savedQuery.isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Сохранённое</Text>
      </View>

      {posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color={colors.textTertiary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Ничего не сохранено</Text>
          <Text style={styles.emptyText}>Нажмите на закладку под постом, чтобы сохранить его здесь</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id ?? item.post?.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GRID_GAP }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={5}
        />
      )}
    </View>
  );
};
