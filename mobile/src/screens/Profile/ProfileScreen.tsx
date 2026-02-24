import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
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
const GRID_GAP = 1;
const TOP_BAR_HEIGHT = 48;

const ALBUM_COLORS = [
  ['#F59E0B', '#EF4444'],
  ['#0F766E', '#14B8A6'],
  ['#EC4899', '#8B5CF6'],
  ['#3B82F6', '#6366F1'],
  ['#10B981', '#059669'],
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
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
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
          paddingBottom: spacing.sm,
          zIndex: 10,
          backgroundColor: colors.background,
        },
        topBarTitle: {
          ...typography.bodyBold,
          fontSize: 18,
          flex: 1,
          color: colors.text,
        },
        backButton: {
          padding: spacing.sm,
          marginRight: spacing.xs,
        },
        settingsButton: {
          padding: spacing.sm,
        },
        header: {
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.background,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.md,
        },
        avatarWrap: {
          marginRight: spacing.xl,
        },
        avatarRing: {
          width: 86,
          height: 86,
          borderRadius: 43,
          padding: 3,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: colors.primary,
        },
        avatarInner: {
          width: 78,
          height: 78,
          borderRadius: 39,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.surface,
        },
        avatarImage: {
          width: '100%',
          height: '100%',
        },
        statsRow: {
          flex: 1,
          flexDirection: 'row',
          justifyContent: 'space-around',
        },
        statItem: {
          alignItems: 'center',
        },
        statValue: {
          ...typography.title,
          fontSize: 18,
          color: colors.text,
        },
        statLabel: {
          ...typography.captionMuted,
          marginTop: 2,
          color: colors.textSecondary,
        },
        nameSection: {
          marginBottom: spacing.md,
        },
        displayName: {
          ...typography.bodyBold,
          fontSize: 14,
          color: colors.text,
        },
        bio: {
          ...typography.caption,
          marginTop: 2,
          lineHeight: 18,
          color: colors.textSecondary,
        },
        actions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        primaryButton: {
          flex: 1,
          paddingVertical: spacing.sm,
          borderRadius: radius.sm,
          borderWidth: StyleSheet.hairlineWidth,
          alignItems: 'center',
          justifyContent: 'center',
          height: 36,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        primaryButtonText: {
          ...typography.bodyBold,
          fontSize: 13,
          color: colors.text,
        },
        secondaryButton: {
          width: 36,
          height: 36,
          borderRadius: radius.sm,
          borderWidth: StyleSheet.hairlineWidth,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        highlightsSection: {
          paddingVertical: spacing.md,
        },
        highlightsContent: {
          paddingHorizontal: spacing.lg,
        },
        highlightItem: {
          alignItems: 'center',
          marginRight: spacing.lg,
          width: 68,
        },
        highlightCircleColored: {
          borderWidth: 2,
        },
        highlightCircle: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.xs,
        },
        highlightCircleAdd: {
          borderStyle: 'dashed',
        },
        highlightCircleInner: {
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        },
        highlightLabel: {
          ...typography.label,
          fontSize: 10,
          color: colors.textSecondary,
          textAlign: 'center',
        },
        tabs: {
          flexDirection: 'row',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        tab: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: spacing.md,
        },
        tabActive: {},
        tabIndicator: {
          position: 'absolute',
          bottom: 0,
          left: '20%',
          right: '20%',
          height: 1.5,
          backgroundColor: 'transparent',
          borderRadius: 1,
        },
        tabIndicatorActive: {
          backgroundColor: colors.text,
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
        },
        gridItem: {
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.05)',
        },
        gridItemSkeleton: {
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.surface,
        },
        gridImage: {
          width: '100%',
          height: '100%',
        },
        gridPlaceholder: {
          flex: 1,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
        },
        gridMultiIcon: {
          position: 'absolute',
          top: spacing.xs,
          right: spacing.xs,
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: 4,
          padding: 2,
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
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.lg,
        },
        emptyTitle: {
          ...typography.title,
          fontSize: 18,
          color: colors.text,
          marginBottom: spacing.xs,
        },
        emptySubtitle: {
          ...typography.caption,
          color: colors.textSecondary,
          textAlign: 'center',
          marginBottom: spacing.lg,
        },
        emptyButton: {
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm + 2,
          backgroundColor: colors.primary,
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
          color: colors.text,
          marginTop: spacing.lg,
          marginBottom: spacing.xs,
          textAlign: 'center',
        },
        errorSubtitle: {
          ...typography.caption,
          color: colors.textSecondary,
          textAlign: 'center',
          marginBottom: spacing.xl,
        },
        errorButton: {
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm + 2,
          backgroundColor: colors.primary,
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
          color: colors.textSecondary,
        },
      }),
    [colors],
  );
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

  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
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

  const itemSize = Math.floor((width - GRID_GAP * (COLS - 1)) / COLS);

  const profileQuery = useQuery({
    queryKey: ['profile', profileUserId],
    enabled: !!profileUserId,
    queryFn: async () => apiService.getUserProfile(profileUserId as string),
    retry: 2,
    retryDelay: 1000,
  });

  const postsQuery = useQuery({
    queryKey: ['profilePosts', profileUserId],
    enabled: !!profileUserId,
    queryFn: async () => apiService.getPostsByUser(profileUserId as string, 1, 30),
  });

  const savedQuery = useQuery({
    queryKey: ['savedPosts'],
    enabled: isOwnProfile && activeTab === 1,
    queryFn: async () => apiService.getSavedPosts(1, 30),
  });
  const loadingSaved = savedQuery.isLoading;

  const albumsQuery = useQuery({
    queryKey: isOwnProfile ? ['myAlbums'] : ['userAlbums', profileUserId],
    enabled: !!profileUserId,
    queryFn: () => isOwnProfile ? apiService.getMyAlbums() : apiService.getUserAlbums(profileUserId as string),
    staleTime: 30_000,
  });
  const albums = useMemo(() => {
    if (!albumsQuery.data) return [];
    if (isOwnProfile) {
      return [...(albumsQuery.data.owned ?? []), ...(albumsQuery.data.memberOf ?? [])];
    }
    return albumsQuery.data ?? [];
  }, [albumsQuery.data, isOwnProfile]);

  const loading = profileQuery.isLoading || postsQuery.isLoading;

  useFocusEffect(
    useCallback(() => {
      if (!profileUserId) return;
      profileQuery.refetch();
      postsQuery.refetch();
    }, [profileUserId]),
  );

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

  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile' as never);
  }, [navigation]);

  const openPost = useCallback(
    (postId: string) => {
      (navigation as any).push('PostDetail', { postId: String(postId) });
    },
    [navigation],
  );

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
  const displayUser = profileFromQuery ?? (isOwnProfile ? authUser : null);

  const handleShare = useCallback(async () => {
    const u = displayUser;
    try {
      await Share.share({
        message: `Профиль HeirLink: @${u?.username ?? 'user'}`,
        title: 'Профиль HeirLink',
      });
    } catch {}
  }, [displayUser?.username]);
  const displayFollowersCount = profileData?.followersCount ?? followersCount;
  const displayFollowingCount = profileData?.followingCount ?? 0;
  const displayPostsTotal = profileData?.postsCount ?? 0;
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

  const postsFromQuery: PostItem[] =
    postsQuery.isSuccess && (postsQuery.data as any)?.posts
      ? ((postsQuery.data as any).posts as any[]).map((p: any) => ({
          id: p.id,
          media: p.media ?? [],
        }))
      : [];
  const savedFromQuery: PostItem[] =
    savedQuery.isSuccess && (savedQuery.data as any)?.posts
      ? ((savedQuery.data as any).posts as any[]).map((p: any) => ({
          id: p.id,
          media: p.media ?? [],
        }))
      : [];
  const gridItems =
    activeTab === 0
      ? postsFromQuery
      : activeTab === 1
        ? savedFromQuery
        : [];
  const showEmptyGrid = activeTab === 0 && !loading && gridItems.length === 0;
  const showSavedEmpty = activeTab === 1 && !loadingSaved && savedFromQuery.length === 0;
  const showSavedLoading = activeTab === 1 && loadingSaved;
  const showTaggedEmpty = activeTab === 2;
  const tabsToShow = isOwnProfile ? TABS : TABS.slice(0, 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        {/* Шапка: аватар + статистика в одну строку (Instagram style) */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}>
                <View style={styles.avatarInner}>
                  {displayUser?.avatarUrl ? (
                    <SmartImage uri={displayUser.avatarUrl} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person" size={40} color={colors.textTertiary} />
                  )}
                </View>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{displayPostsTotal}</Text>
                <Text style={styles.statLabel}>постов</Text>
              </View>
              <TouchableOpacity style={styles.statItem} onPress={() => profileUserId && (navigation as any).push('FollowList', { userId: profileUserId, mode: 'followers', username: displayName })}>
                <Text style={styles.statValue}>{displayFollowersCount}</Text>
                <Text style={styles.statLabel}>подписчиков</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem} onPress={() => profileUserId && (navigation as any).push('FollowList', { userId: profileUserId, mode: 'following', username: displayName })}>
                <Text style={styles.statValue}>{displayFollowingCount}</Text>
                <Text style={styles.statLabel}>подписок</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.nameSection}>
            <Text style={styles.displayName}>{displayName}</Text>
            {bio && bio !== 'Расскажите о себе' && (
              <Text style={styles.bio}>{bio}</Text>
            )}
          </View>

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
                  <Ionicons name="share-outline" size={18} color={colors.text} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    displayIsFollowing ? undefined : { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={handleFollow}
                  disabled={followLoading}
                  activeOpacity={0.8}
                >
                  {followLoading ? (
                    <ActivityIndicator size="small" color={displayIsFollowing ? colors.text : '#fff'} />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: displayIsFollowing ? colors.text : '#fff' }]}>
                      {displayIsFollowing ? 'Отписаться' : 'Подписаться'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() =>
                    (navigation as any).push('ChatThread', { userId: profileUserId })
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="paper-plane-outline" size={18} color={colors.text} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Альбомы */}
        {(isOwnProfile || albums.length > 0) && (
          <View style={styles.highlightsSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.highlightsContent}
            >
              {isOwnProfile && (
                <TouchableOpacity
                  style={styles.highlightItem}
                  activeOpacity={0.9}
                  onPress={() => (navigation as any).push('CreateAlbum')}
                >
                  <View style={[styles.highlightCircle, styles.highlightCircleAdd]}>
                    <Ionicons name="add" size={24} color={colors.textSecondary} />
                  </View>
                  <Text style={styles.highlightLabel} numberOfLines={1}>Создать</Text>
                </TouchableOpacity>
              )}
              {albums.map((album: any, idx: number) => {
                const coverUrl = album.coverUrl ?? album.items?.[0]?.media?.url;
                const accentColor = ALBUM_COLORS[idx % ALBUM_COLORS.length][0];
                return (
                  <TouchableOpacity
                    key={album.id}
                    style={styles.highlightItem}
                    activeOpacity={0.9}
                    onPress={() => (navigation as any).push('AlbumDetail', { albumId: album.id, albumName: album.name })}
                  >
                    <View
                      style={[
                        styles.highlightCircle,
                        styles.highlightCircleColored,
                        { borderColor: accentColor },
                      ]}
                    >
                      <View style={styles.highlightCircleInner}>
                        {coverUrl ? (
                          <SmartImage uri={coverUrl} style={{ width: 58, height: 58, borderRadius: 29 }} />
                        ) : (
                          <Ionicons name="images-outline" size={20} color={colors.textTertiary} />
                        )}
                      </View>
                    </View>
                    <Text style={styles.highlightLabel} numberOfLines={1}>
                      {album.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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
              <View style={[styles.tabIndicator, activeTab === i && { backgroundColor: colors.text }]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Сетка постов / сохранённые / пустые состояния */}
        {loading && activeTab === 0 ? (
          <View style={styles.grid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.gridItem,
                  styles.gridItemSkeleton,
                  {
                    width: itemSize,
                    height: itemSize,
                    marginRight: (i % COLS) === (COLS - 1) ? 0 : GRID_GAP,
                    marginBottom: GRID_GAP,
                  },
                ]}
              />
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
            {Array.from({ length: 9 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.gridItem,
                  styles.gridItemSkeleton,
                  {
                    width: itemSize,
                    height: itemSize,
                    marginRight: (i % COLS) === (COLS - 1) ? 0 : GRID_GAP,
                    marginBottom: GRID_GAP,
                  },
                ]}
              />
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
            {gridItems.map((item, idx) => {
              const thumb = item.media?.[0];
              const thumbUrl = thumb?.thumbnailUrl || thumb?.url;
              const isLastCol = (idx % COLS) === (COLS - 1);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.gridItem,
                    {
                      width: itemSize,
                      height: itemSize,
                      marginRight: isLastCol ? 0 : GRID_GAP,
                      marginBottom: GRID_GAP,
                    },
                  ]}
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
      <View style={[styles.topBar, { top: insets.top }]}>
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
            onPress={() => (navigation as any).push('Settings')}
            activeOpacity={0.8}
          >
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              const opts = ['Пожаловаться', 'Заблокировать', 'Отмена'];
              const handler = (text: string) => {
                if (text === 'Пожаловаться') {
                  (async () => {
                    try {
                      await apiService.createReport('user', profileUserId!, 'Нарушение правил');
                      Alert.alert('Спасибо', 'Жалоба отправлена');
                    } catch { Alert.alert('Ошибка', 'Не удалось отправить'); }
                  })();
                }
                if (text === 'Заблокировать') {
                  Alert.alert('Заблокировать', `Заблокировать ${displayUser?.username}?`, [
                    { text: 'Отмена', style: 'cancel' },
                    {
                      text: 'Заблокировать', style: 'destructive',
                      onPress: async () => {
                        try {
                          await apiService.blockUser(profileUserId!);
                          Alert.alert('Готово', 'Пользователь заблокирован');
                          navigation.goBack();
                        } catch { Alert.alert('Ошибка', 'Не удалось заблокировать'); }
                      },
                    },
                  ]);
                }
              };
              if (Platform.OS === 'ios') {
                ActionSheetIOS.showActionSheetWithOptions(
                  { options: opts, destructiveButtonIndex: 1, cancelButtonIndex: 2 },
                  (idx) => { if (idx < 2) handler(opts[idx]); },
                );
              } else {
                Alert.alert('Действия', undefined, [
                  { text: 'Пожаловаться', onPress: () => handler('Пожаловаться') },
                  { text: 'Заблокировать', style: 'destructive', onPress: () => handler('Заблокировать') },
                  { text: 'Отмена', style: 'cancel' },
                ]);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

