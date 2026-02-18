import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '../types/index';
import { useTheme } from '../context/ThemeContext';
import { colors as themeColors, spacing, radius, typography } from '../theme';
import { apiService } from '../services/api';
import { SmartImage } from './SmartImage';

interface PostCardProps {
  post?: Post;
  onLikeChange?: (postId: string, isLiked: boolean) => void;
  onSaveChange?: (postId: string, isSaved: boolean) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = spacing.lg;
const MEDIA_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;

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

export const PostCard: React.FC<PostCardProps> = ({ post, onLikeChange, onSaveChange }) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [isLiked, setIsLiked] = useState(post?.isLiked ?? false);
  const [isSaved, setIsSaved] = useState(post?.isSaved ?? false);
  const [likesCount, setLikesCount] = useState(post?.likesCount ?? 0);

  React.useEffect(() => {
    if (post) {
      setIsLiked(post.isLiked);
      setIsSaved(post.isSaved ?? false);
      setLikesCount(post.likesCount);
    }
  }, [post?.id, post?.isLiked, post?.isSaved, post?.likesCount]);

  const handleLike = useCallback(async () => {
    if (!post?.id) return;
    try {
      await apiService.likePost(post.id);
      const next = !isLiked;
      setIsLiked(next);
      setLikesCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
      onLikeChange?.(post.id, next);
    } catch {
      // ignore
    }
  }, [post?.id, isLiked, onLikeChange]);

  const handleSave = useCallback(async () => {
    if (!post?.id) return;
    try {
      if (isSaved) await apiService.unsavePost(post.id);
      else await apiService.savePost(post.id);
      const next = !isSaved;
      setIsSaved(next);
      onSaveChange?.(post.id, next);
    } catch {
      // ignore
    }
  }, [post?.id, isSaved, onSaveChange]);

  const handleComment = useCallback(() => {
    if (post?.id != null) {
      (navigation as any).push('PostDetail', { postId: String(post.id) });
    }
  }, [post?.id, navigation]);

  const handlePress = useCallback(() => {
    if (post?.id != null) {
      (navigation as any).push('PostDetail', { postId: String(post.id) });
    }
  }, [post?.id, navigation]);

  const openAuthorProfile = useCallback(() => {
    const authorId = post?.userId ?? post?.user?.id;
    const userIdStr = authorId != null ? String(authorId).trim() : '';
    if (__DEV__) {
      console.log('[HeirLink PostCard:openAuthorProfile]', { authorId, userIdStr, postId: post?.id, hasUser: !!post?.user });
    }
    if (userIdStr) {
      (navigation as any).push('Profile', { userId: userIdStr });
    }
  }, [post?.userId, post?.user?.id, post?.id, post?.user, navigation]);

  const user = post?.user;
  const username = user?.username ?? '?';
  const firstMedia = post?.media?.[0];
  const timeStr = post?.createdAt ? formatTime(post.createdAt) : '';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={openAuthorProfile}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {user?.avatarUrl ? (
              <SmartImage uri={user.avatarUrl} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={20} color={colors.textTertiary} />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.username}>{username}</Text>
            <Text style={styles.time}>{timeStr}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.media} activeOpacity={1} onPress={handlePress}>
        {firstMedia?.url ? (
          <SmartImage uri={firstMedia.url} style={styles.mediaImage} />
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.mediaLabel}>Фото</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton} activeOpacity={0.7}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={26}
              color={isLiked ? colors.like : colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleComment} style={styles.actionButton} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
            <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSave} style={styles.actionButton} activeOpacity={0.7}>
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

      {(post?.caption != null && post.caption !== '') && (
        <View style={styles.caption}>
          <Text style={styles.captionText} numberOfLines={2}>
            <Text style={styles.usernameInline}>{username}</Text>
            <Text style={styles.captionBody}> {post.caption}</Text>
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: CARD_PADDING,
    marginBottom: spacing.xl,
    backgroundColor: themeColors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: themeColors.shadowStrong,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  headerText: {
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
  moreButton: {
    padding: spacing.xs,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  media: {
    width: '100%',
    aspectRatio: 1,
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
    gap: spacing.sm,
  },
  mediaLabel: {
    ...typography.caption,
    color: themeColors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
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
  usernameInline: {
    ...typography.bodyBold,
    color: themeColors.text,
  },
  captionBody: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
});
