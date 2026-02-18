import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors as themeColors, spacing, typography } from '../../theme';
import { apiService } from '../../services/api';
import { Post, Comment } from '../../types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SmartImage } from '../../components/SmartImage';

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

/**
 * Экран поста с комментариями — данные с API getPost, getComments; like/save, createComment
 */
export const PostDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const route = useRoute<RouteProp<{ PostDetail: PostDetailParams }, 'PostDetail'>>();
  const { width } = useWindowDimensions();
  // postId: из params и из state текущего стека (на случай задержки обновления route)
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
  const queryClient = useQueryClient();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const postQuery = useQuery({
    queryKey: ['post', postId],
    enabled: !!postId,
    queryFn: async () => apiService.getPost(postId as string),
    retry: 2,
    retryDelay: 1000,
    onSuccess: (data: any) => {
      const p = data as any;
      setPost({
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
      });
      setIsLiked(p.isLiked ?? false);
      setIsSaved(p.isSaved ?? false);
      setLikesCount(p.likesCount ?? 0);
    },
    onError: () => setPost(null),
  });

  const commentsQuery = useQuery({
    queryKey: ['comments', postId],
    enabled: !!postId,
    queryFn: async () => apiService.getComments(postId as string, 1, 50),
    onSuccess: (res: any) => {
      const list = (res?.comments ?? []).map((c: any) => ({
        id: c.id,
        postId: c.postId,
        userId: c.userId,
        user: c.user ?? { id: c.userId, username: '?', avatarUrl: undefined },
        text: c.text,
        parentId: c.parentId,
        replies: c.replies ?? [],
        createdAt: c.createdAt ?? '',
      }));
      setComments(list);
    },
    onError: () => setComments([]),
  });

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
      if (post) setPost({ ...post, commentsCount: post.commentsCount + 1 });
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [postId, commentText, sending, commentsQuery, post]);

  if (!postId) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Пост не найден</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (postQuery.isLoading && !post) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!post && !postQuery.isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Не удалось загрузить пост</Text>
        <TouchableOpacity onPress={() => postQuery.refetch()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Повторить</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const user = post.user;
  const username = user?.username ?? '?';
  const firstMedia = post.media?.[0];
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
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Публикация</Text>
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
            <View style={styles.avatar}>
              {user?.avatarUrl ? (
                <SmartImage uri={user.avatarUrl} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={24} color={colors.textTertiary} />
              )}
            </View>
            <View style={styles.postHeaderText}>
              <Text style={styles.username}>{username}</Text>
              <Text style={styles.time}>{timeStr}</Text>
            </View>
          </View>
          <View style={[styles.media, { width, height: width }]}>
            {firstMedia?.url ? (
              <SmartImage uri={firstMedia.url} style={styles.mediaImage} />
            ) : (
              <View style={styles.mediaPlaceholder}>
                <Ionicons name="image-outline" size={64} color={colors.textTertiary} />
              </View>
            )}
          </View>
          <View style={styles.actions}>
            <View style={styles.actionsLeft}>
              <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.8}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={28}
                  color={isLiked ? colors.like : colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <Ionicons name="chatbubble-outline" size={26} color={colors.text} />
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
            <View style={styles.likesRow}>
              <Text style={styles.likesCount}>{likesCount} нравится</Text>
            </View>
          )}
          {(post.caption != null && post.caption !== '') && (
            <View style={styles.caption}>
              <Text style={styles.captionText}>
                <Text style={styles.usernameBold}>{username}</Text>
                {' ' + post.caption}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Комментарии ({comments.length})</Text>
          {comments.map(renderComment)}
        </View>
      </ScrollView>

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.avatarSmall}>
          <Ionicons name="person" size={18} color={colors.textTertiary} />
        </View>
        <TextInput
          style={styles.input}
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
            <Text style={[styles.sendText, !commentText.trim() && styles.sendTextDisabled]}>Отправить</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: themeColors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyBold,
    color: themeColors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  post: {
    backgroundColor: themeColors.surface,
    marginBottom: spacing.lg,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  postHeaderText: {
    flex: 1,
  },
  username: {
    ...typography.bodyBold,
    color: themeColors.text,
  },
  time: {
    ...typography.captionMuted,
    color: themeColors.textTertiary,
    marginTop: 2,
  },
  media: {
    backgroundColor: themeColors.background,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBtn: {
    padding: spacing.sm,
  },
  likesRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  likesCount: {
    ...typography.bodyBold,
    color: themeColors.text,
  },
  caption: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  captionText: {
    ...typography.body,
    color: themeColors.text,
  },
  usernameBold: {
    ...typography.bodyBold,
  },
  commentsSection: {
    paddingHorizontal: spacing.lg,
  },
  commentsTitle: {
    ...typography.bodyBold,
    color: themeColors.text,
    marginBottom: spacing.md,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  commentAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentBody: {
    flex: 1,
  },
  commentText: {
    ...typography.body,
    color: themeColors.text,
  },
  commentUser: {
    fontWeight: '600',
  },
  commentTime: {
    ...typography.captionMuted,
    color: themeColors.textTertiary,
    marginTop: 2,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: themeColors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.border,
    gap: spacing.sm,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    ...typography.body,
    color: themeColors.text,
    paddingVertical: spacing.sm,
    padding: 0,
  },
  sendButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: {
    ...typography.bodyBold,
    color: themeColors.primary,
  },
  sendTextDisabled: {
    color: themeColors.textTertiary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginBottom: spacing.md,
  },
  link: {
    ...typography.bodyBold,
    color: themeColors.primary,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  retryButtonText: {
    ...typography.bodyBold,
    color: themeColors.primary,
  },
});
