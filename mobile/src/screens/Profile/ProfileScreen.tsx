import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Share,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { colors as themeColors, spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { RootState, AppDispatch } from '../../store/store';
import { restoreUserFromStorage, checkAuth, logout } from '../../store/authSlice';
import { useQuery } from '@tanstack/react-query';
import { SmartImage } from '../../components/SmartImage';

const TABS = [
  { key: 'posts', label: 'Посты', icon: 'grid-outline' as const },
  { key: 'saved', label: 'Сохранённые', icon: 'bookmark-outline' as const },
  { key: 'tagged', label: 'Отметки', icon: 'person-outline' as const },
];
const COLS = 3;
const GRID_GAP = 2;
const TOP_BAR_HEIGHT = 52;

const HIGHLIGHTS = [
  { id: '1', name: 'Путешествия', color: ['#F59E0B', '#EF4444'] },
  { id: '2', name: 'Семья', color: ['#0F766E', '#14B8A6'] },
  { id: '3', name: 'Еда', color: ['#EC4899', '#8B5CF6'] },
  { id: '4', name: 'Добавить', isAdd: true },
];

type PostItem = {
  id: string;
  media?: Array<{ url: string; thumbnailUrl?: string | null; type: string }>;
};

type ProfileParams = { userId?: string };

/**
 * Экран профиля — свой или чужой (userId в params). Посты, сохранённые (API), статистика.
 */
export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const route = useRoute<RouteProp<{ Profile: ProfileParams }, 'Profile'>>();
  const dispatch = useDispatch<AppDispatch>();
  const { width } = useWindowDimensions();
  const authUser = useSelector((state: RootState) => state.auth.user);
  // userId: из params экрана, из state текущего стека (push может обновить state раньше, чем route), из state таба Profile
  const paramFromRoute = route.params?.userId != null ? String(route.params.userId).trim() : undefined;
  const paramFromNavState = (() => {
    try {
      const state = navigation.getState();
      const r = state?.routes?.[state.index ?? 0] as any;
      const uid = r?.params?.userId;
      return uid != null && uid !== '' ? String(uid).trim() : undefined;
    } catch {
      return undefined;
    }
  })();
  const paramFromTabState = (() => {
    try {
      const tabState = (navigation.getParent() as any)?.getParent()?.getState?.();
      const profileTab = tabState?.routes?.find((r: any) => r.name === 'ProfileTab');
      const stackState = profileTab?.state;
      const profileRoute = stackState?.routes?.[stackState.index ?? 0];
      const uid = (profileRoute as any)?.params?.userId;
      return uid != null && uid !== '' ? String(uid).trim() : undefined;
    } catch {
      return undefined;
    }
  })();
  const paramUserId = paramFromRoute ?? paramFromNavState ?? paramFromTabState;
  const paramUserIdClean =
    paramUserId && typeof paramUserId === 'string'
      ? paramUserId.trim()
      : '';
  const paramUserIdValid =
    paramUserIdClean &&
    paramUserIdClean !== 'undefined' &&
    paramUserIdClean !== 'null'
      ? paramUserIdClean
      : undefined;

  const isOwnProfile = !paramUserIdValid || paramUserIdValid === authUser?.id;
  const profileUserId = paramUserIdValid || authUser?.id;

  // Логирование для отладки перехода в профиль другого пользователя
  if (__DEV__) {
    const logKey = 'ProfileScreen:params';
    const logPayload = {
      paramFromRoute: paramFromRoute ?? null,
      paramFromNavState: paramFromNavState ?? null,
      paramFromTabState: paramFromTabState ?? null,
      paramUserIdValid: paramUserIdValid ?? null,
      profileUserId: profileUserId ?? null,
      isOwnProfile,
      authUserId: authUser?.id ?? null,
    };
    if ((global as any).__lastProfileLog !== JSON.stringify(logPayload)) {
      (global as any).__lastProfileLog = JSON.stringify(logPayload);
      console.log(`[HeirLink ${logKey}]`, JSON.stringify(logPayload, null, 2));
    }
  }

  const [profileUser, setProfileUser] = useState<{
    id: string;
    username: string;
    avatarUrl?: string | null;
    bio?: string | null;
  } | null>(isOwnProfile && authUser ? { id: authUser.id, username: authUser.username, avatarUrl: authUser.avatarUrl, bio: authUser.bio } : null);
  const [activeTab, setActiveTab] = useState(0);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postsTotal, setPostsTotal] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showUserError, setShowUserError] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const restoreAttempted = useRef(false);

  useEffect(() => {
    if (!authUser && !restoreAttempted.current && isOwnProfile) {
      restoreAttempted.current = true;
      dispatch(restoreUserFromStorage());
      const t = setTimeout(() => setShowUserError(true), 1500);
      return () => clearTimeout(t);
    }
  }, [authUser, isOwnProfile, dispatch]);

  const itemSize = (width - GRID_GAP * (COLS - 1)) / COLS;

  const profileQuery = useQuery({
    queryKey: ['profile', profileUserId],
    enabled: !!profileUserId,
    queryFn: async () => apiService.getUserProfile(profileUserId as string),
    retry: 2,
    retryDelay: 1000,
    onSuccess: (profile: any) => {
      if (__DEV__) {
        console.log('[HeirLink ProfileScreen:getUserProfile] success', { profileUserId, username: profile?.username });
      }
      setProfileUser({
        id: profileUserId as string,
        username: profile?.username ?? '?',
        avatarUrl: profile?.avatarUrl ?? null,
        bio: profile?.bio ?? null,
      });
      setFollowersCount(profile?.followersCount ?? 0);
      setFollowingCount(profile?.followingCount ?? 0);
      setPostsTotal(profile?.postsCount ?? 0);
      setIsFollowing(profile?.isFollowing ?? false);
    },
    onError: (err: any) => {
      if (__DEV__) {
        const status = err?.response?.status;
        const url = err?.config?.url ?? err?.config?.baseURL;
        console.warn('[HeirLink ProfileScreen:getUserProfile] error', {
          profileUserId,
          status,
          message: err?.message,
          url: err?.config ? `${err.config.baseURL ?? ''}${err.config.url ?? ''}` : url,
        });
      }
      if (isOwnProfile) return;
      setProfileUser(null);
    },
  });

  const postsQuery = useQuery({
    queryKey: ['profilePosts', profileUserId],
    enabled: !!profileUserId,
    queryFn: async () => apiService.getPostsByUser(profileUserId as string, 1, 30),
    onSuccess: (data: any) => {
      const list = (data.posts ?? []).map((p: any) => ({
        id: p.id,
        media: p.media ?? [],
      }));
      setPosts(list);
      setPostsTotal((prev) => (data.pagination?.total != null ? data.pagination.total : prev));
    },
    onError: () => {
      setPosts([]);
      setPostsTotal(0);
    },
  });

  const savedQuery = useQuery({
    queryKey: ['savedPosts'],
    enabled: isOwnProfile && activeTab === 1,
    queryFn: async () => apiService.getSavedPosts(1, 30),
    onSuccess: (data: any) => {
      const list = (data.posts ?? []).map((p: any) => ({
        id: p.id,
        media: p.media ?? [],
      }));
      setSavedPosts(list);
    },
    onError: () => {
      setSavedPosts([]);
    },
  });
  const loadingSaved = savedQuery.isLoading;

  useEffect(() => {
    if (profileUserId) {
      setLoading(true);
      if (isOwnProfile && authUser) {
        setProfileUser({ id: authUser.id, username: authUser.username, avatarUrl: authUser.avatarUrl, bio: authUser.bio });
      } else {
        setProfileUser(null);
      }
    } else {
      setLoading(false);
      setPosts([]);
      setProfileUser(null);
    }
  }, [profileUserId, isOwnProfile, authUser?.id]);

  // При открытии экрана с другим userId — принудительно подтягиваем данные (навигация с другой вкладки может отдать params с задержкой)
  useFocusEffect(
    useCallback(() => {
      if (!profileUserId) return;
      profileQuery.refetch();
      postsQuery.refetch();
    }, [profileUserId, profileQuery, postsQuery]),
  );

  useEffect(() => {
    const busy = profileQuery.isLoading || postsQuery.isLoading;
    if (!busy) setLoading(false);
  }, [profileQuery.isLoading, postsQuery.isLoading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      profileQuery.refetch(),
      postsQuery.refetch(),
      isOwnProfile && activeTab === 1 ? savedQuery.refetch() : Promise.resolve(),
    ]).finally(() => setRefreshing(false));
  }, [profileQuery, postsQuery, isOwnProfile, activeTab, savedQuery]);

  const handleFollow = useCallback(async () => {
    if (!profileUserId || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await apiService.unfollowUser(profileUserId);
        setIsFollowing(false);
        setFollowersCount((c) => Math.max(0, c - 1));
      } else {
        await apiService.followUser(profileUserId);
        setIsFollowing(true);
        setFollowersCount((c) => c + 1);
      }
    } catch {
      // ignore
    } finally {
      setFollowLoading(false);
    }
  }, [profileUserId, isFollowing, followLoading]);

  const handleShare = useCallback(async () => {
    const u = profileUser ?? authUser;
    try {
      await Share.share({
        message: `Профиль HeirLink: @${u?.username ?? 'user'}`,
        title: 'Профиль HeirLink',
      });
    } catch {}
  }, [profileUser?.username, authUser?.username]);

  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile' as never);
  }, [navigation]);

  const openPost = useCallback(
    (postId: string) => {
      (navigation as any).push('PostDetail', { postId: String(postId) });
    },
    [navigation],
  );

  // При успешном ответе API берём пользователя и счётчики из query.data, чтобы не терять из-за гонки с useEffect
  const profileData = profileQuery.isSuccess ? (profileQuery.data as any) : null;
  const profileFromQuery =
    profileData && profileUserId
      ? {
          id: profileUserId,
          username: profileData?.username ?? '?',
          avatarUrl: profileData?.avatarUrl ?? null,
          bio: profileData?.bio ?? null,
        }
      : null;
  const displayUser = profileFromQuery ?? profileUser ?? (isOwnProfile ? authUser : null);
  const displayFollowersCount = profileData?.followersCount ?? followersCount;
  const displayFollowingCount = profileData?.followingCount ?? followingCount;
  const displayPostsTotal = profileData?.postsCount ?? postsTotal;
  const displayIsFollowing = profileData != null ? (profileData?.isFollowing ?? isFollowing) : isFollowing;

  if (isOwnProfile && !authUser) {
    if (!showUserError) {
      return (
        <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={styles.errorCard}>
          <Ionicons name="person-circle-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.errorTitle}>Не удалось загрузить профиль</Text>
          <Text style={styles.errorSubtitle}>
            Войдите снова или проверьте соединение
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => dispatch(checkAuth())}
            activeOpacity={0.8}
          >
            <Text style={styles.errorButtonText}>Повторить</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.errorButtonSecondary}
            onPress={() => dispatch(logout())}
            activeOpacity={0.8}
          >
            <Text style={styles.errorButtonSecondaryText}>Выйти</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!displayUser && !loading && profileUserId) {
    const is404 =
      (profileQuery.error as any)?.response?.status === 404;
    const isNetwork =
      !(profileQuery.error as any)?.response?.status &&
      ((profileQuery.error as any)?.code === 'ERR_NETWORK' ||
        (profileQuery.error as any)?.message?.includes?.('Network'));
    const errorTitle = isNetwork
      ? 'Нет соединения с сервером'
      : is404
        ? 'Пользователь не найден'
        : 'Не удалось загрузить профиль';
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorTitle}>{errorTitle}</Text>
        <TouchableOpacity onPress={() => { profileQuery.refetch(); postsQuery.refetch(); }} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Повторить</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.errorButton, styles.errorButtonSecondary]}>
          <Text style={styles.errorButtonSecondaryText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayName = displayUser?.username || 'Пользователь';
  const bio = displayUser?.bio || 'Расскажите о себе';

  // Как в Instagram: посты из API (при успехе — из query.data, иначе из state)
  const postsFromQuery =
    activeTab === 0 && postsQuery.isSuccess && postsQuery.data?.posts
      ? (postsQuery.data.posts as any[]).map((p: any) => ({
          id: p.id,
          media: p.media ?? [],
        }))
      : null;
  const gridItems =
    activeTab === 0
      ? (postsFromQuery ?? posts)
      : activeTab === 1
        ? savedPosts
        : [];
  const showEmptyGrid = activeTab === 0 && !loading && gridItems.length === 0;
  const showSavedEmpty = activeTab === 1 && !loadingSaved && savedPosts.length === 0;
  const showSavedLoading = activeTab === 1 && loadingSaved;
  const showTaggedEmpty = activeTab === 2;
  const tabsToShow = isOwnProfile ? TABS : TABS.slice(0, 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: TOP_BAR_HEIGHT,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Шапка: аватар, имя, био, кнопки */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                {displayUser?.avatarUrl ? (
                  <SmartImage uri={displayUser.avatarUrl} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={44} color={colors.textTertiary} />
                )}
              </View>
            </View>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.username}>@{displayUser?.username ?? '?'}</Text>
          <Text style={styles.bio}>{bio}</Text>

          <View style={styles.actions}>
            {isOwnProfile ? (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleEditProfile}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Редактировать профиль</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-outline" size={20} color={colors.text} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryButton, displayIsFollowing && styles.followButtonActive]}
                  onPress={handleFollow}
                  disabled={followLoading}
                  activeOpacity={0.8}
                >
                  {followLoading ? (
                    <ActivityIndicator size="small" color={displayIsFollowing ? colors.text : '#fff'} />
                  ) : (
                    <Text style={[styles.primaryButtonText, displayIsFollowing && styles.followButtonTextActive]}>
                      {displayIsFollowing ? 'Отписаться' : 'Подписаться'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleShare}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-outline" size={20} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() =>
                    (navigation.getParent() as any)?.navigate('ChatTab', {
                      screen: 'ChatThread',
                      params: { userId: profileUserId },
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="paper-plane-outline" size={20} color={colors.text} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {isOwnProfile && (
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('SmartAlbum' as never)}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIconWrap}>
                  <Ionicons name="sparkles" size={22} color={colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>Умный альбом</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionCard}
                onPress={() => navigation.navigate('LocalMedia' as never)}
                activeOpacity={0.8}
              >
                <View style={styles.quickActionIconWrap}>
                  <Ionicons name="folder-open-outline" size={22} color={colors.primary} />
                </View>
                <Text style={styles.quickActionLabel}>Медиатека</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Статистика */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{displayPostsTotal}</Text>
            <Text style={styles.statLabel}>публикаций</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{displayFollowersCount}</Text>
            <Text style={styles.statLabel}>подписчиков</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{displayFollowingCount}</Text>
            <Text style={styles.statLabel}>подписок</Text>
          </View>
        </View>

        {/* Хайлайты */}
        <View style={styles.highlightsSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.highlightsContent}
          >
            {HIGHLIGHTS.map((h) => (
              <TouchableOpacity
                key={h.id}
                style={styles.highlightItem}
                activeOpacity={0.9}
              >
                {h.isAdd ? (
                  <View style={[styles.highlightCircle, styles.highlightCircleAdd]}>
                    <Ionicons name="add" size={28} color={colors.text} />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.highlightCircle,
                      styles.highlightCircleColored,
                      { borderColor: (h as { color: string[] }).color[0] },
                    ]}
                  >
                    <View style={styles.highlightCircleInner}>
                      <Ionicons name="images-outline" size={22} color={colors.textTertiary} />
                    </View>
                  </View>
                )}
                <Text style={styles.highlightLabel} numberOfLines={1}>
                  {h.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Табы */}
        <View style={styles.tabs}>
          {tabsToShow.map((tab, i) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === i && styles.tabActive]}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={activeTab === i ? colors.text : colors.textTertiary}
              />
              <View style={[styles.tabIndicator, activeTab === i && styles.tabIndicatorActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Сетка постов / сохранённые / пустые состояния */}
        {loading && activeTab === 0 ? (
          <View style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[styles.gridItem, styles.gridItemSkeleton, { width: itemSize, height: itemSize }]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ))}
          </View>
        ) : showEmptyGrid ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Пока нет публикаций</Text>
            {isOwnProfile ? (
              <>
                <Text style={styles.emptySubtitle}>Добавьте первый пост в разделе «Создать»</Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => {
                    const tabNav = navigation.getParent();
                    if (tabNav) {
                      tabNav.navigate('Create' as never);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.emptyButtonText}>Создать пост</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.emptySubtitle}>У пользователя пока нет постов</Text>
            )}
          </View>
        ) : showSavedLoading ? (
          <View style={styles.grid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[styles.gridItem, styles.gridItemSkeleton, { width: itemSize, height: itemSize }]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ))}
          </View>
        ) : showSavedEmpty ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bookmark-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Сохранённые публикации</Text>
            <Text style={styles.emptySubtitle}>Сохраняйте понравившиеся посты сюда</Text>
          </View>
        ) : showTaggedEmpty ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Фото с вами</Text>
            <Text style={styles.emptySubtitle}>Здесь появятся посты, где вас отметили</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {gridItems.map((item) => {
              const thumb = item.media?.[0];
              const thumbUrl = thumb?.thumbnailUrl || thumb?.url;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.gridItem, { width: itemSize, height: itemSize }]}
                  onPress={() => openPost(item.id)}
                  activeOpacity={0.9}
                >
                  {thumbUrl ? (
                    <SmartImage uri={thumbUrl} style={styles.gridImage} />
                  ) : (
                    <View style={styles.gridPlaceholder}>
                      <Ionicons name="image-outline" size={28} color={colors.textTertiary} />
                    </View>
                  )}
                  {item.media && item.media.length > 1 ? (
                    <View style={styles.gridMultiIcon}>
                      <Ionicons name="layers-outline" size={14} color="#fff" />
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Плавающая шапка */}
      <View style={[styles.topBar, { top: insets.top, paddingTop: Platform.OS === 'ios' ? spacing.sm : spacing.md }]}>
        {!isOwnProfile ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {displayUser?.username ?? '?'}
        </Text>
        {isOwnProfile ? (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              // Settings is inside ProfileStack; use getParent to reach Tab navigator
              const tabNav = navigation.getParent();
              if (tabNav) {
                tabNav.navigate('ProfileTab' as never, { screen: 'Settings' } as never);
              } else {
                (navigation as any).navigate('Settings');
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : <View style={styles.settingsButton} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(250, 250, 250, 0.9)',
    zIndex: 10,
  },
  topBarTitle: {
    ...typography.bodyBold,
    fontSize: 18,
    color: themeColors.text,
    flex: 1,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  avatarWrap: {
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: themeColors.primary,
  },
  avatarInner: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: themeColors.surface,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  displayName: {
    ...typography.title,
    fontSize: 20,
    color: themeColors.text,
    marginBottom: 2,
  },
  username: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginBottom: spacing.sm,
  },
  bio: {
    ...typography.caption,
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    backgroundColor: themeColors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: themeColors.text,
  },
  followButtonActive: {
    backgroundColor: themeColors.background,
    borderColor: themeColors.border,
  },
  followButtonTextActive: {
    color: themeColors.text,
  },
  secondaryButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: themeColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  quickActionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    gap: spacing.sm,
  },
  quickActionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(15, 118, 110, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    ...typography.bodyBold,
    color: themeColors.text,
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    marginHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.title,
    fontSize: 18,
    color: themeColors.text,
  },
  statLabel: {
    ...typography.captionMuted,
    color: themeColors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: themeColors.border,
  },
  highlightsSection: {
    paddingVertical: spacing.lg,
  },
  highlightsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  highlightItem: {
    alignItems: 'center',
    marginRight: spacing.xl,
    width: 76,
  },
  highlightCircleColored: {
    borderWidth: 2,
  },
  highlightCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: themeColors.surface,
    borderWidth: 2,
    borderColor: themeColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  highlightCircleAdd: {
    borderStyle: 'dashed',
  },
  highlightCircleInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightLabel: {
    ...typography.label,
    color: themeColors.textSecondary,
    textAlign: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tabActive: {},
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '30%',
    right: '30%',
    height: 2,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: themeColors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: GRID_GAP / 2,
  },
  gridItem: {
    margin: GRID_GAP / 2,
    backgroundColor: themeColors.surface,
    overflow: 'hidden',
  },
  gridItemSkeleton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridPlaceholder: {
    flex: 1,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  gridMultiIcon: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  emptyState: {
    paddingVertical: spacing.xxl * 2,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: themeColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.title,
    fontSize: 18,
    color: themeColors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.caption,
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    backgroundColor: themeColors.primary,
    borderRadius: radius.md,
  },
  emptyButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },
  errorCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    maxWidth: 320,
  },
  errorTitle: {
    ...typography.title,
    fontSize: 18,
    color: themeColors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  errorSubtitle: {
    ...typography.caption,
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    backgroundColor: themeColors.primary,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  errorButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },
  errorButtonSecondary: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  errorButtonSecondaryText: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
});
