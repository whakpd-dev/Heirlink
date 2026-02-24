import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
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

const AVATAR_SIZE = 62;
const RING_SIZE = 68;
const ITEM_WIDTH = 74;
const GRADIENT_COLORS = ['#F58529', '#DD2A7B', '#8134AF', '#515BD4'] as const;
const SEEN_RING_COLOR = '#DBDBDB';

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

  const openAddStory = () => {
    (navigation.getParent() as any)?.navigate('FeedTab', {
      screen: 'StoriesViewer',
      params: { stories: myStories, initialIndex: 0, userName: currentUser?.username ?? 'Ваша история', isOwn: true, openPicker: true },
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

  const hasMyStories = myStories.length > 0;

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* "Your Story" button */}
        {currentUser && (
          <TouchableOpacity
            style={styles.storyItem}
            activeOpacity={0.7}
            onPress={() => hasMyStories ? openViewer(myStories, currentUser.username ?? 'Вы', true) : openAddStory()}
          >
            <View style={styles.avatarContainer}>
              {hasMyStories ? (
                <LinearGradient
                  colors={[...GRADIENT_COLORS]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientRing}
                >
                  <View style={[styles.innerRing, { backgroundColor: colors.background }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                      {currentUser.avatarUrl ? (
                        <SmartImage uri={currentUser.avatarUrl} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="person" size={28} color={colors.textTertiary} />
                      )}
                    </View>
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.plainRing, { borderColor: colors.border }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                    {currentUser.avatarUrl ? (
                      <SmartImage uri={currentUser.avatarUrl} style={styles.avatarImage} />
                    ) : (
                      <Ionicons name="person" size={28} color={colors.textTertiary} />
                    )}
                  </View>
                </View>
              )}
              {/* Blue "+" badge */}
              <View style={styles.addBadge}>
                <View style={[styles.addBadgeInner, { borderColor: colors.background, backgroundColor: colors.primary }]}>
                  <Ionicons name="add" size={14} color="#FFF" />
                </View>
              </View>
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              Ваша история
            </Text>
          </TouchableOpacity>
        )}

        {/* Other users' stories */}
        {feed.map(({ user, stories }) => {
          if (stories.length === 0) return null;
          return (
            <TouchableOpacity
              key={user.id}
              style={styles.storyItem}
              activeOpacity={0.7}
              onPress={() => openViewer(stories, user.username, false)}
            >
              <View style={styles.avatarContainer}>
                <LinearGradient
                  colors={[...GRADIENT_COLORS]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientRing}
                >
                  <View style={[styles.innerRing, { backgroundColor: colors.background }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                      {user.avatarUrl ? (
                        <SmartImage uri={user.avatarUrl} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="person" size={28} color={colors.textTertiary} />
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
              <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                {user.username}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 0.5,
  },
  contentContainer: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyItem: {
    alignItems: 'center',
    width: ITEM_WIDTH,
    marginRight: 4,
  },
  avatarContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    marginBottom: 4,
  },
  gradientRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plainRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE - 4,
    height: AVATAR_SIZE - 4,
    borderRadius: (AVATAR_SIZE - 4) / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  addBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  addBadgeInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0095F6',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: ITEM_WIDTH,
  },
});
