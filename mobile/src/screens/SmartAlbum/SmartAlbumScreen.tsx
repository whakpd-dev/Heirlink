import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNetInfo } from '@react-native-community/netinfo';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { SmartImage } from '../../components/SmartImage';

const POLL_INTERVAL_MS = 2500;
const GRID_COLUMNS = 3;
const GRID_GAP = 2;

interface SmartAlbumItemRow {
  id: string;
  originalMediaId: string;
  aiAnalysis?: unknown;
  lifeMomentTags?: unknown;
  locationData?: unknown;
  createdAt: string;
}

/**
 * Экран умного альбома — загрузка медиа для ИИ-анализа, список элементов, переход в деталь
 */
export const SmartAlbumScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const netInfo = useNetInfo();
  const cellSize = (width - spacing.lg * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const isMounted = useRef(true);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backButton: {
          width: 40,
          height: 40,
          justifyContent: 'center',
          alignItems: 'center',
        },
        title: {
          ...typography.title,
          color: colors.text,
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          padding: spacing.lg,
        },
        subtitle: {
          ...typography.body,
          color: colors.textSecondary,
          marginBottom: spacing.lg,
        },
        uploadCard: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginBottom: spacing.xl,
          gap: spacing.md,
        },
        uploadIconWrap: {
          width: 56,
          height: 56,
          borderRadius: radius.md,
          justifyContent: 'center',
          alignItems: 'center',
        },
        uploadBody: {
          flex: 1,
        },
        uploadTitle: {
          ...typography.bodyBold,
          color: colors.text,
          marginBottom: 2,
        },
        uploadSubtitle: {
          ...typography.caption,
          color: colors.textSecondary,
        },
        uploadingWrap: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.md,
        },
        uploadingText: {
          ...typography.body,
          color: colors.textSecondary,
        },
        sectionTitle: {
          ...typography.bodyBold,
          color: colors.text,
          marginBottom: spacing.md,
        },
        loadingWrap: {
          paddingVertical: spacing.xl,
          alignItems: 'center',
        },
        empty: {
          paddingVertical: spacing.xl,
          alignItems: 'center',
        },
        emptyText: {
          ...typography.body,
          color: colors.textTertiary,
          marginTop: spacing.sm,
        },
        grid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: GRID_GAP,
        },
        cellWrap: {
          marginBottom: 0,
        },
        cell: {
          borderRadius: radius.sm,
          overflow: 'hidden',
          backgroundColor: colors.surface,
        },
        cellImage: {
          width: '100%',
          height: '100%',
        },
        cellPlaceholder: {
          width: '100%',
          height: '100%',
          justifyContent: 'center',
          alignItems: 'center',
        },
        loadMoreBtn: {
          marginTop: spacing.lg,
          paddingVertical: spacing.md,
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
        },
        loadMoreText: {
          ...typography.bodyBold,
          color: colors.primary,
        },
      }),
    [colors],
  );

  const [items, setItems] = useState<SmartAlbumItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  const loadItems = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      const res = await apiService.getSmartAlbumItems(page, 20);
      const list = (res?.items ?? []).map((i: any) => ({
        id: i.id,
        originalMediaId: i.originalMediaId ?? '',
        aiAnalysis: i.aiAnalysis,
        lifeMomentTags: i.lifeMomentTags,
        locationData: i.locationData,
        createdAt: i.createdAt ?? '',
      }));
      setItems((prev) => (append ? [...prev, ...list] : list));
      setPagination({
        page: res?.pagination?.page ?? page,
        totalPages: res?.pagination?.totalPages ?? 1,
      });
    } catch {
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems(1);
    }, [loadItems]),
  );
  useEffect(() => () => {
    isMounted.current = false;
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadItems(1);
  }, [loadItems]);

  const loadMore = useCallback(() => {
    if (loadingMore || loading || pagination.page >= pagination.totalPages) return;
    loadItems(pagination.page + 1, true);
  }, [loadingMore, loading, pagination, loadItems]);

  const pickAndUpload = async () => {
    if (netInfo.isConnected === false) {
      showToast('Нет сети. Загрузка недоступна.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ', 'Нужен доступ к галерее для выбора фото.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    setJobStatus('Загрузка...');
    try {
      const { url } = await apiService.uploadFile(result.assets[0].uri, 'photo');
      setJobStatus('Анализ ИИ...');
      const { jobId } = await apiService.smartAlbumUpload(url, 'photo');

      let done = false;
      while (!done && isMounted.current) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (!isMounted.current) break;
        const job = await apiService.getSmartAlbumJob(jobId);
        const status = job?.status ?? '';
        if (!isMounted.current) break;
        setJobStatus(status === 'processing' ? 'Обработка...' : status === 'done' ? 'Готово' : status);
        if (status === 'done') {
          if (!isMounted.current) break;
          setItems((prev) => {
            const newItem = {
              id: job.resultItemId ?? '',
              originalMediaId: url,
              createdAt: new Date().toISOString(),
            };
            return [newItem as SmartAlbumItemRow, ...prev];
          });
          showToast('Фото добавлено в умный альбом');
          done = true;
        } else if (status === 'failed') {
          Alert.alert(
            'Ошибка',
            (job as any)?.errorMessage ?? 'Анализ не удался. Попробуйте позже.',
          );
          done = true;
        }
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      Alert.alert('Ошибка', msg ?? 'Не удалось загрузить или проанализировать фото.');
    } finally {
      setUploading(false);
      setJobStatus(null);
    }
  };

  const openItem = (itemId: string) => {
    (navigation as any).navigate('SmartAlbumItem', { itemId });
  };

  const renderItem = ({ item }: { item: SmartAlbumItemRow }) => {
    const mediaUrl = item.originalMediaId?.startsWith('http') ? item.originalMediaId : undefined;
    return (
      <TouchableOpacity
        style={[styles.cell, { width: cellSize, height: cellSize }]}
        onPress={() => openItem(item.id)}
        activeOpacity={0.9}
      >
        {mediaUrl ? (
          <SmartImage uri={mediaUrl} style={styles.cellImage} />
        ) : (
          <View style={styles.cellPlaceholder}>
            <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Умный альбом</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.subtitle}>ИИ-анализ ваших фото: события, места, эмоции</Text>

        <TouchableOpacity
          style={styles.uploadCard}
          onPress={pickAndUpload}
          disabled={uploading}
          activeOpacity={0.9}
        >
          {uploading ? (
            <View style={styles.uploadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.uploadingText}>{jobStatus ?? 'Ожидание...'}</Text>
            </View>
          ) : (
            <>
              <View style={[styles.uploadIconWrap, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
              </View>
              <View style={styles.uploadBody}>
                <Text style={styles.uploadTitle}>Добавить фото для анализа</Text>
                <Text style={styles.uploadSubtitle}>Загрузите фото — ИИ определит момент и место</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.textTertiary} />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Элементы альбома</Text>

        {loading && items.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Пока нет элементов. Загрузите фото выше.</Text>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {items.map((item) => (
                <View key={item.id} style={[styles.cellWrap, { width: cellSize, height: cellSize }]}>
                  {renderItem({ item })}
                </View>
              ))}
            </View>
            {pagination.page < pagination.totalPages && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={loadMore}
                disabled={loadingMore}
                activeOpacity={0.8}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Загрузить ещё</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};
