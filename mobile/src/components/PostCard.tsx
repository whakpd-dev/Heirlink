import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  ViewToken,
  Animated,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Post } from '../types/index';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, typography } from '../theme';
import { apiService } from '../services/api';
import { SmartImage } from './SmartImage';

interface PostCardProps {
  post?: Post;
  onLikeChange?: (postId: string, isLiked: boolean) => void;
  onSaveChange?: (postId: string, isSaved: boolean) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    const prev = isLiked;
    const next = !prev;
    setIsLiked(next);
    setLikesCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    onLikeChange?.(post.id, next);
    try {
      await apiService.likePost(post.id);
    } catch {
      setIsLiked(prev);
      setLikesCount((c) => (prev ? c + 1 : Math.max(0, c - 1)));
    }
  }, [post?.id, isLiked, onLikeChange]);

  const handleSave = useCallback(async () => {
    if (!post?.id) return;
    const prev = isSaved;
    const next = !prev;
    setIsSaved(next);
    onSaveChange?.(post.id, next);
    try {
      if (prev) await apiService.unsavePost(post.id);
      else await apiService.savePost(post.id);
    } catch {
      setIsSaved(prev);
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

  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTapRef = useRef(0);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!isLiked && post?.id) {
        handleLike();
      }
      heartOpacity.setValue(1);
      heartScale.setValue(0);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1, friction: 3, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(heartOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
    lastTapRef.current = now;
  }, [isLiked, post?.id, handleLike, heartScale, heartOpacity]);

  const user = post?.user;
  const username = user?.username ?? '?';
  const mediaList = post?.media ?? [];
  const timeStr = post?.createdAt ? formatTime(post.createdAt) : '';
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveMediaIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  return (
    <View style={[styles.card, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={openAuthorProfile}
          activeOpacity={0.7}
        >
          <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
            {user?.avatarUrl ? (
              <SmartImage uri={user.avatarUrl} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={18} color={colors.textTertiary} />
            )}
          </View>
          <Text style={[styles.username, { color: colors.text }]}>{username}</Text>
          {post?.location ? (
            <Text style={[styles.location, { color: colors.textSecondary }]}>{post.location}</Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.moreButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <Pressable onPress={handleDoubleTap}>
        {mediaList.length > 1 ? (
          <View>
            <FlatList
              data={mediaList}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item, i) => item.url || String(i)}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              renderItem={({ item }) => (
                <View style={styles.media}>
                  <SmartImage uri={item.url} style={styles.mediaImage} />
                </View>
              )}
            />
            {mediaList.length > 1 && (
              <View style={styles.dotsRow}>
                {mediaList.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: i === activeMediaIndex ? colors.primary : 'rgba(255,255,255,0.4)' },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.media}>
            {mediaList[0]?.url ? (
              <SmartImage uri={mediaList[0].url} style={styles.mediaImage} />
            ) : (
              <View style={[styles.mediaPlaceholder, { backgroundColor: colors.surface }]}>
                <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
              </View>
            )}
          </View>
        )}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heartOverlay,
            { opacity: heartOpacity, transform: [{ scale: heartScale }] },
          ]}
        >
          <Ionicons name="heart" size={80} color="#fff" />
        </Animated.View>
      </Pressable>

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
        <Text style={[styles.likesCount, { color: colors.text }]}>{likesCount} нравится</Text>
      )}

      {(post?.caption != null && post.caption !== '') && (
        <View style={styles.caption}>
          <Text style={[styles.captionText, { color: colors.text }]} numberOfLines={2}>
            <Text style={styles.usernameInline}>{username}</Text>
            {'  '}{post.caption}
          </Text>
        </View>
      )}

      <Text style={[styles.time, { color: colors.textTertiary }]}>{timeStr}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
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
  username: {
    ...typography.bodyBold,
    fontSize: 13,
  },
  location: {
    ...typography.captionMuted,
    fontSize: 11,
    marginLeft: spacing.xs,
  },
  time: {
    ...typography.captionMuted,
    fontSize: 11,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  moreButton: {
    padding: spacing.xs,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  media: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#000',
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
  heartOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
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
  actionButton: {
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
  usernameInline: {
    ...typography.bodyBold,
    fontSize: 13,
  },
});
