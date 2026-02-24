import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { SmartImage } from '../../components/SmartImage';

type RouteParams = { SmartAlbumItem: { itemId: string } };

/**
 * Экран детали элемента умного альбома — медиа, AI-анализ, теги, локация
 */
export const SmartAlbumItemScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const route = useRoute<RouteProp<RouteParams, 'SmartAlbumItem'>>();
  const itemId = route.params?.itemId ?? '';

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
        errorText: {
          ...typography.body,
          color: colors.textSecondary,
          marginBottom: spacing.md,
        },
        backBtn: {
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.primary,
          borderRadius: radius.md,
        },
        backBtnText: {
          ...typography.bodyBold,
          color: colors.surface,
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
        headerBtn: {
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
        mediaWrap: {
          width: '100%',
          aspectRatio: 1,
          borderRadius: radius.lg,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          marginBottom: spacing.lg,
        },
        media: {
          width: '100%',
          height: '100%',
        },
        mediaPlaceholder: {
          width: '100%',
          aspectRatio: 1,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: spacing.lg,
        },
        section: {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
        },
        sectionTitle: {
          ...typography.bodyBold,
          color: colors.text,
          marginBottom: spacing.sm,
        },
        row: {
          flexDirection: 'row',
          marginBottom: spacing.xs,
          gap: spacing.sm,
        },
        label: {
          ...typography.caption,
          color: colors.textTertiary,
          minWidth: 100,
        },
        value: {
          ...typography.body,
          color: colors.text,
          flex: 1,
        },
        date: {
          ...typography.captionMuted,
          color: colors.textTertiary,
        },
      }),
    [colors],
  );

  const [item, setItem] = useState<{
    id: string;
    originalMediaId: string;
    aiAnalysis?: Record<string, unknown>;
    lifeMomentTags?: unknown;
    locationData?: Record<string, unknown>;
    createdAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!itemId) return;
    try {
      const data = await apiService.getSmartAlbumItem(itemId);
      setItem({
        id: data.id,
        originalMediaId: data.originalMediaId ?? '',
        aiAnalysis: (data.aiAnalysis ?? undefined) as Record<string, unknown> | undefined,
        lifeMomentTags: data.lifeMomentTags,
        locationData: (data.locationData ?? undefined) as Record<string, unknown> | undefined,
        createdAt: data.createdAt ?? '',
      });
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [itemId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading && !item) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Не удалось загрузить элемент</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mediaUrl = item.originalMediaId?.startsWith('http')
    ? item.originalMediaId
    : undefined;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Элемент альбома</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {mediaUrl ? (
          <View style={styles.mediaWrap}>
            <SmartImage uri={mediaUrl} style={styles.media} />
          </View>
        ) : (
          <View style={styles.mediaPlaceholder}>
            <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
          </View>
        )}

        {item.aiAnalysis && Object.keys(item.aiAnalysis).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Анализ ИИ</Text>
            {Object.entries(item.aiAnalysis).map(([key, value]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.label}>{key}</Text>
                <Text style={styles.value}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {item.lifeMomentTags != null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Моменты</Text>
            <Text style={styles.value}>
              {Array.isArray(item.lifeMomentTags)
                ? item.lifeMomentTags.join(', ')
                : JSON.stringify(item.lifeMomentTags)}
            </Text>
          </View>
        )}

        {item.locationData && Object.keys(item.locationData).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Место</Text>
            {Object.entries(item.locationData).map(([key, value]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.label}>{key}</Text>
                <Text style={styles.value}>{String(value)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.date}>
          Добавлено: {new Date(item.createdAt).toLocaleString()}
        </Text>
      </ScrollView>
    </View>
  );
};
