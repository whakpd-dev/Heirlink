import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { colors as themeColors, spacing, radius, typography } from '../theme';
import { apiService } from '../services/api';
import { RootState } from '../store/store';
import { SmartImage } from './SmartImage';

interface StoryItem {
  id: string;
  mediaUrl: string;
  type: string;
  expiresAt: string;
  createdAt: string;
}

interface FeedUser {
  user: { id: string; username: string; avatarUrl: string | null };
  stories: StoryItem[];
}

/**
 * Горизонтальный скролл историй — данные с API (лента + свои)
 */
export const StoriesRail: React.FC = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const [feed, setFeed] = useState<FeedUser[]>([]);
  const [myStories, setMyStories] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [feedRes, myRes] = await Promise.all([
        apiService.getStoriesFeed(),
        apiService.getMyStories(),
      ]);
      setFeed(Array.isArray(feedRes) ? feedRes : []);
      setMyStories(Array.isArray(myRes) ? myRes : []);
    } catch {
      setFeed([]);
      setMyStories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const openViewer = (stories: StoryItem[], userName: string, isOwn: boolean) => {
    (navigation.getParent() as any)?.navigate('FeedTab', {
      screen: 'StoriesViewer',
      params: { stories, initialIndex: 0, userName, isOwn },
    });
  };

  if (loading && feed.length === 0 && myStories.length === 0) {
    return (
      <View style={[styles.container, styles.loadingWrap]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const showRail = feed.length > 0 || myStories.length > 0 || currentUser;
  if (!showRail) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {currentUser && (
        <TouchableOpacity
          style={styles.storyItem}
          activeOpacity={0.8}
          onPress={() => openViewer(myStories, 'Ваша история', true)}
        >
          <View style={[styles.ring, styles.ringOwn, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
            <View style={[styles.avatar, { backgroundColor: colors.background }]}>
              {myStories.length > 0 && (myStories[0].mediaUrl?.startsWith('http') ?? false) ? (
                <SmartImage uri={myStories[0].mediaUrl} style={styles.avatarImage} />
              ) : (
                <Ionicons name="add" size={28} color={colors.textSecondary} />
              )}
            </View>
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
            Ваша
          </Text>
        </TouchableOpacity>
      )}
      {feed.map(({ user, stories }) => {
        if (stories.length === 0) return null;
        const firstMedia = stories[0].mediaUrl?.startsWith('http') ?? false;
        return (
          <TouchableOpacity
            key={user.id}
            style={styles.storyItem}
            activeOpacity={0.8}
            onPress={() => openViewer(stories, user.username, false)}
          >
            <View style={[styles.ring, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                {user.avatarUrl ? (
                  <SmartImage uri={user.avatarUrl} style={styles.avatarImage} />
                ) : firstMedia ? (
                  <SmartImage uri={stories[0].mediaUrl} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={24} color={colors.textTertiary} />
                )}
              </View>
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {user.username}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const AVATAR_SIZE = 64;
const RING_WIDTH = 3;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  storyItem: {
    alignItems: 'center',
    marginRight: spacing.lg,
    width: 78,
  },
  ring: {
    width: AVATAR_SIZE + RING_WIDTH * 2,
    height: AVATAR_SIZE + RING_WIDTH * 2,
    borderRadius: (AVATAR_SIZE + RING_WIDTH * 2) / 2,
    padding: RING_WIDTH,
    backgroundColor: themeColors.surface,
    borderWidth: RING_WIDTH,
    borderColor: themeColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  ringOwn: {
    borderColor: themeColors.borderStrong,
    borderStyle: 'dashed',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  label: {
    ...typography.label,
    color: themeColors.textSecondary,
    textAlign: 'center',
  },
});
