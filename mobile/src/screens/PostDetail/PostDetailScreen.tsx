import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
  FlatList,
  Dimensions,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';
import { apiService } from '../../services/api';
import { Comment } from '../../types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SmartImage } from '../../components/SmartImage';
import { MediaItem } from '../../components/MediaItem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type PostDetailParams = { postId?: string };

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

export const PostDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const route = useRoute<RouteProp<{ PostDetail: PostDetailParams }, 'PostDetail'>>();
  const { width } = useWindowDimensions();
  const rawFromRoute = route.params?.postId;
  const rawFromNavState = (() => {
    try {
      const state = navigation.getState();
      const r = state?.routes?.[state.index ?? 0] as any;
      return r?.params?.postId;
    } catch {
      return undefined;
    }
  })();
  const rawPostId = rawFromRoute ?? rawFromNavState;
  const postId = rawPostId != null && rawPostId !== '' ? String(rawPostId) : undefined;

  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveMediaIndex(viewableItems[0].index);
    }
  }).current;
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 80 }).current;

  const postQuery = useQuery({
    queryKey: ['post', postId],
    enabled: !!postId,
    queryFn: async () => apiService.getPost(postId as string),
    retry: 2,
    retryDelay: 1000,
  });

  const post = useMemo(() => {
    const p = postQuery.data as any;
    if (!p) return null;
    return {
      id: p.id as string,
      userId: p.userId as string,
      user: p.user ?? { id: p.userId, username: '?', avatarUrl: undefined },
      caption: p.caption as string | undefined,
      location: p.location as string | undefined,
      media: (p.media ?? []) as Array<{ id: string; url: string; type: string; thumbnailUrl?: string; order: number }>,
      likesCount: (p.likesCount ?? 0) as number,
      commentsCount: (p.commentsCount ?? 0) as number,
      isLiked: (p.isLiked ?? false) as boolean,
      isSaved: (p.isSaved ?? false) as boolean,
      createdAt: (p.createdAt ?? '') as string,
    };
  }, [postQuery.data]);

  useEffect(() => {
    if (post) {
      setIsLiked(post.isLiked);
      setIsSaved(post.isSaved);
      setLikesCount(post.likesCount);
    }
  }, [post?.id, post?.isLiked, post?.isSaved, post?.likesCount]);

  const commentsQuery = useQuery({
    queryKey: ['comments', postId],
    enabled: !!postId,
    queryFn: async () => apiService.getComments(postId as string, 1, 50),
  });

  const comments: Comment[] = useMemo(() => {
    const res = commentsQuery.data as any;
    if (!res?.comments) return [];
    return (res.comments as any[]).map((c: any) => ({
      id: c.id,
      postId: c.postId,
      userId: c.userId,
      user: c.user ?? { id: c.userId, username: '?', avatarUrl: undefined },
      text: c.text,
      parentId: c.parentId,
      replies: c.replies ?? [],
      createdAt: c.createdAt ?? '',
    }));
  }, [commentsQuery.data]);

  const likeMutation = useMutation({
    mutationFn: () => apiService.likePost(postId as string),
    onSuccess: () => {
      const next = !isLiked;
      setIsLiked(next);
      setLikesCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    },
  });
  const handleLike = useCallback(() => {
    if (!postId) return;
    likeMutation.mutate();
  }, [postId, likeMutation]);

  const saveMutation = useMutation({
    mutationFn: () => (isSaved ? apiService.unsavePost(postId as string) : apiService.savePost(postId as string)),
    onSuccess: () => setIsSaved(!isSaved),
  });
  const handleSave = useCallback(() => {
    if (!postId) return;
    saveMutation.mutate();
  }, [postId, saveMutation]);

  const handleSendComment = useCallback(async () => {
    const text = commentText.trim();
    if (!postId || !text || sending) return;
    setSending(true);
    try {
      await apiService.createComment(postId, text);
      setCommentText('');
      await commentsQuery.refetch();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [postId, commentText, sending, commentsQuery]);

  const openMediaViewer = useCallback((index: number) => {
    if (!post?.media?.length) return;
    (navigation as any).push('MediaViewer', {
      items: post.media,
      initialIndex: index,
      isPostMedia: true,
      postUser: post?.user,
      postCreatedAt: post?.createdAt,
    });
  }, [navigation, post?.media, post?.user, post?.createdAt]);

  if (!postId) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Пост не найден</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.link, { color: colors.primary }]}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (postQuery.isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!post && postQuery.isError) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Не удалось загрузить пост</Text>
        <TouchableOpacity onPress={() => postQuery.refetch()} style={styles.retryButton}>
          <Text style={[styles.retryButtonText, { color: colors.primary }]}>Повторить</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.link, { color: colors.primary }]}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const user = post.user;
  const username = user?.username ?? '?';
  const mediaList = post.media ?? [];
  const timeStr = post.createdAt ? formatTime(post.createdAt) : '';

  const renderComment = (c: Comment) => (
    <View key={c.id} style={styles.commentRow}>
      <View style={styles.commentAvatar}>
        {c.user?.avatarUrl ? (
            <SmartImage uri={c.user.avatarUrl} style={styles.commentAvatarImg} />
        ) : (
          <Ionicons name="person" size={20} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.commentBody}>
        <Text style={styles.commentText}>
          <Text style={styles.commentUser}>{c.user?.username ?? '?'}</Text>
          {' ' + c.text}
        </Text>
        <Text style={styles.commentTime}>{formatTime(c.createdAt)}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Публикация</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.post}>
          <View style={styles.postHeader}>
            <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
              {user?.avatarUrl ? (
                <SmartImage uri={user.avatarUrl} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={18} color={colors.textTertiary} />
              )}
            </View>
            <Text style={[styles.username, { color: colors.text }]}>{username}</Text>
          </View>
          {mediaList.length > 0 ? (
            <TouchableOpacity activeOpacity={0.95} onPress={() => openMediaViewer(activeMediaIndex)}>
              {mediaList.length > 1 ? (
                <View style={{ width: SCREEN_WIDTH }}>
                  <FlatList
                    data={mediaList}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item, i) => item.url || String(i)}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
                    renderItem={({ item }) => (
                      <View style={{ width: SCREEN_WIDTH, aspectRatio: 1, backgroundColor: '#000' }}>
                        <MediaItem
                          uri={item.url}
                          type={item.type}
                          thumbnailUrl={item.thumbnailUrl}
                          style={styles.mediaImage}
                          muted
                        />
                      </View>
                    )}
                  />
                  <View style={styles.dotsRow}>
                    {mediaList.map((_: any, i: number) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          { backgroundColor: i === activeMediaIndex ? colors.primary : 'rgba(255,255,255,0.4)' },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <View style={{ width: SCREEN_WIDTH, aspectRatio: 1, backgroundColor: '#000' }}>
                  <MediaItem
                    uri={mediaList[0].url}
                    type={mediaList[0].type}
                    thumbnailUrl={mediaList[0].thumbnailUrl}
                    style={styles.mediaImage}
                    muted
                  />
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.media, { width: SCREEN_WIDTH, height: SCREEN_WIDTH }]}>
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="image-outline" size={64} color={colors.textTertiary} />
              </View>
            </View>
          )}
          <View style={styles.actions}>
            <View style={styles.actionsLeft}>
              <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.8}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={26}
                  color={isLiked ? colors.like : colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleSave} style={styles.actionBtn}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
          {likesCount > 0 && (
            <Text style={[styles.likesCount, { color: colors.text }]}>{likesCount} нравится</Text>
          )}
          {(post.caption != null && post.caption !== '') && (
            <View style={styles.caption}>
              <Text style={[styles.captionText, { color: colors.text }]}>
                <Text style={styles.usernameBold}>{username}</Text>
                {'  '}{post.caption}
              </Text>
            </View>
          )}
          <Text style={[styles.time, { color: colors.textTertiary }]}>{timeStr}</Text>
        </View>

        <View style={styles.commentsSection}>
          <Text style={[styles.commentsTitle, { color: colors.text }]}>Комментарии ({comments.length})</Text>
          {comments.map(renderComment)}
        </View>
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm, backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={[styles.avatarSmall, { backgroundColor: colors.surface }]}>
          <Ionicons name="person" size={16} color={colors.textTertiary} />
        </View>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Добавьте комментарий..."
          placeholderTextColor={colors.textTertiary}
          value={commentText}
          onChangeText={setCommentText}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!commentText.trim() || sending) && styles.sendDisabled]}
          disabled={!commentText.trim() || sending}
          onPress={handleSendComment}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.sendText, { color: colors.primary }, !commentText.trim() && { color: colors.textTertiary }]}>
              Отправить
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  post: {},
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  username: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  time: {
    ...typography.captionMuted,
    fontSize: 11,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  media: {
    backgroundColor: '#000',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: spacing.sm,
  },
  likesCount: {
    ...typography.bodyBold,
    fontSize: 13,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  caption: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  captionText: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  usernameBold: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  commentsSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  commentsTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  commentAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentBody: {
    flex: 1,
  },
  commentText: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
  },
  commentUser: {
    fontWeight: '600',
  },
  commentTime: {
    ...typography.captionMuted,
    fontSize: 11,
    marginTop: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    ...typography.body,
    fontSize: 14,
    paddingVertical: spacing.sm,
    padding: 0,
  },
  sendButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  link: {
    ...typography.bodyBold,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryButtonText: {
    ...typography.bodyBold,
  },
});
