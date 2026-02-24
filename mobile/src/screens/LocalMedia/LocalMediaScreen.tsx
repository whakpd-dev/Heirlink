import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Image,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';

const COLS = 3;
const GRID_GAP = 2;
const PAGE_SIZE = 100;
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

type MediaAsset = MediaLibrary.Asset;

function getMonthKey(creationTime: number): string {
  const d = new Date(creationTime);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthTitle(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}

/**
 * Экран локальной медиатеки — фото и видео с устройства, фильтр по дате
 */
export const LocalMediaScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [hasNextPage, setHasNextPage] = useState(false);
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  const itemSize = (width - GRID_GAP * (COLS - 1) - spacing.lg * 2) / COLS;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        flex1: { flex: 1 },
        centered: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backBtn: {
          width: 40,
          height: 40,
          justifyContent: 'center',
          alignItems: 'center',
        },
        headerTitle: {
          ...typography.title,
          fontSize: 18,
          color: colors.text,
        },
        filters: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        filterChips: {
          flexDirection: 'row',
          gap: spacing.sm,
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        chipActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        chipText: {
          ...typography.caption,
          color: colors.textSecondary,
        },
        chipTextActive: {
          color: '#fff',
        },
        permissionIconWrap: {
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.lg,
        },
        permissionTitle: {
          ...typography.title,
          fontSize: 18,
          color: colors.text,
          marginBottom: spacing.xs,
          textAlign: 'center',
        },
        permissionText: {
          ...typography.caption,
          color: colors.textSecondary,
          textAlign: 'center',
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.xl,
        },
        permissionHint: {
          ...typography.captionMuted,
          fontSize: 11,
          color: colors.textTertiary,
          textAlign: 'center',
          marginBottom: spacing.xl,
          paddingHorizontal: spacing.xl,
        },
        primaryButton: {
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.sm + 2,
          backgroundColor: colors.primary,
          borderRadius: radius.md,
        },
        primaryButtonText: {
          ...typography.bodyBold,
          color: '#fff',
        },
        scroll: {
          flex: 1,
        },
        section: {
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
        },
        sectionTitle: {
          ...typography.bodyBold,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -GRID_GAP / 2,
        },
        gridItem: {
          margin: GRID_GAP / 2,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        gridImage: {
          width: '100%',
          height: '100%',
        },
        videoBadge: {
          position: 'absolute',
          bottom: spacing.xs,
          right: spacing.xs,
        },
        emptyTitle: {
          ...typography.title,
          fontSize: 18,
          color: colors.text,
          marginTop: spacing.md,
        },
        emptySubtitle: {
          ...typography.caption,
          color: colors.textSecondary,
          marginTop: spacing.xs,
        },
        loadMore: {
          padding: spacing.lg,
          alignItems: 'center',
        },
      }),
    [colors],
  );

  const requestPermission = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setPermission(await MediaLibrary.getPermissionsAsync());
    return status === 'granted';
  }, []);

  const loadAssets = useCallback(
    async (after?: string, append = false) => {
      try {
        const mediaType =
          filter === 'photo'
            ? MediaLibrary.MediaType.photo
            : filter === 'video'
              ? MediaLibrary.MediaType.video
              : [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video];

        const options: MediaLibrary.AssetsOptions = {
          first: PAGE_SIZE,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
          mediaType: mediaType as MediaLibrary.MediaType,
        };
        if (after) options.after = after;
        if (selectedMonthKey) {
          const [y, m] = selectedMonthKey.split('-').map(Number);
          const start = new Date(y, m - 1, 1).getTime();
          const end = new Date(y, m, 0, 23, 59, 59).getTime();
          options.createdAfter = start;
          options.createdBefore = end;
        } else if (selectedYear !== null) {
          options.createdAfter = new Date(selectedYear, 0, 1).getTime();
          options.createdBefore = new Date(selectedYear, 11, 31, 23, 59, 59).getTime();
        }

        const result = await MediaLibrary.getAssetsAsync(options);
        setAssets(append ? (prev) => [...prev, ...result.assets] : result.assets);
        setEndCursor(result.endCursor);
        setHasNextPage(result.hasNextPage);
      } catch (e) {
        if (!append) setAssets([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, selectedYear, selectedMonthKey],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const perm = await MediaLibrary.getPermissionsAsync();
      if (cancelled) return;
      setPermission(perm);
      if (!perm.granted) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (permission?.granted) {
      setLoading(true);
      loadAssets();
    }
  }, [permission?.granted, filter, selectedYear, selectedMonthKey, loadAssets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAssets();
  }, [loadAssets]);

  const loadMore = useCallback(() => {
    if (hasNextPage && endCursor && !loading) {
      loadAssets(endCursor, true);
    }
  }, [hasNextPage, endCursor, loading, loadAssets]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, MediaAsset[]>();
    for (const a of assets) {
      const key = getMonthKey(a.creationTime);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((key) => ({ key, title: getMonthTitle(key), data: map.get(key)! }));
  }, [assets]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    assets.forEach((a) => set.add(new Date(a.creationTime).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [assets]);

  if (!permission) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Медиатека</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={[styles.centered, styles.flex1]}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="images-outline" size={64} color={colors.textTertiary} />
          </View>
          <Text style={styles.permissionTitle}>Доступ к фото и видео</Text>
          <Text style={styles.permissionText}>
            Разрешите доступ к медиатеке, чтобы просматривать фото и видео с устройства и фильтровать их по датам.
          </Text>
          {Platform.OS === 'android' && (
            <Text style={styles.permissionHint}>
              В Expo Go доступ к медиатеке на Android ограничен. Для полного доступа соберите development build.
            </Text>
          )}
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Разрешить доступ</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Медиатека</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Фильтры: тип и дата */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChips}>
          {(['all', 'photo', 'video'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={f === 'all' ? 'albums-outline' : f === 'photo' ? 'image-outline' : 'videocam-outline'}
                size={16}
                color={filter === f ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'Всё' : f === 'photo' ? 'Фото' : 'Видео'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {availableYears.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterChips, { marginTop: spacing.sm }]}
          >
            <TouchableOpacity
              style={[styles.chip, selectedYear === null && selectedMonthKey === null && styles.chipActive]}
              onPress={() => {
                setSelectedYear(null);
                setSelectedMonthKey(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, selectedYear === null && !selectedMonthKey && styles.chipTextActive]}>
                Все даты
              </Text>
            </TouchableOpacity>
            {availableYears.map((y) => (
              <TouchableOpacity
                key={y}
                style={[styles.chip, selectedYear === y && !selectedMonthKey && styles.chipActive]}
                onPress={() => {
                  setSelectedYear(selectedYear === y ? null : y);
                  setSelectedMonthKey(null);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedYear === y && !selectedMonthKey && styles.chipTextActive,
                  ]}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={[styles.centered, styles.flex1]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : groupedByMonth.length === 0 ? (
        <View style={[styles.centered, styles.flex1]}>
          <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Нет фото и видео</Text>
          <Text style={styles.emptySubtitle}>
            {filter !== 'all' ? 'Попробуйте другой фильтр' : 'Добавьте медиа на устройство'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const padding = 200;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - padding) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {groupedByMonth.map(({ key, title, data }) => (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>{title}</Text>
              <View style={styles.grid}>
                {data.map((asset) => (
                  <TouchableOpacity
                    key={asset.id}
                    style={[styles.gridItem, { width: itemSize, height: itemSize }]}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri: asset.uri }} style={styles.gridImage} resizeMode="cover" />
                    {asset.mediaType === 'video' && (
                      <View style={styles.videoBadge}>
                        <Ionicons name="videocam" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
          {hasNextPage && (
            <View style={styles.loadMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};
