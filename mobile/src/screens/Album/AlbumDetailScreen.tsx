import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { SmartImage } from '../../components/SmartImage';
import { RootState } from '../../store/store';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 2;
const COLS = 3;
const TILE = (SCREEN_WIDTH - GRID_GAP * (COLS - 1)) / COLS;

export const AlbumDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const authUser = useSelector((state: RootState) => state.auth.user);

  const albumId: string = route.params?.albumId;
  const [cursor, setCursor] = useState<string | undefined>();

  const albumQuery = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => apiService.getAlbum(albumId),
    staleTime: 30_000,
  });

  const itemsQuery = useQuery({
    queryKey: ['albumItems', albumId],
    queryFn: () => apiService.getAlbumItems(albumId),
    staleTime: 30_000,
  });

  const album = albumQuery.data;
  const items = itemsQuery.data ?? [];
  const isOwner = album?.ownerId === authUser?.id;
  const isMember = album?.members?.some((m: any) => m.userId === authUser?.id);
  const canEdit = isOwner || isMember;

  const addItemMutation = useMutation({
    mutationFn: async (uri: string) => apiService.addAlbumItem(albumId, uri, 'photo'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albumItems', albumId] });
      queryClient.invalidateQueries({ queryKey: ['album', albumId] });
      queryClient.invalidateQueries({ queryKey: ['myAlbums'] });
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось добавить фото'),
  });

  const pickMedia = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ', 'Нужен доступ к галерее');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });
    if (result.canceled || !result.assets.length) return;
    for (const asset of result.assets) {
      addItemMutation.mutate(asset.uri);
    }
  }, [addItemMutation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backBtn: { width: 40, height: 40, justifyContent: 'center' },
        headerCenter: { flex: 1, marginHorizontal: spacing.sm },
        headerTitle: { ...typography.title, color: colors.text, fontSize: 18 },
        headerSub: { ...typography.caption, color: colors.textSecondary },
        tile: { width: TILE, height: TILE },
        separator: { width: GRID_GAP, height: GRID_GAP },
        emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
        emptyIcon: { marginBottom: spacing.lg },
        emptyTitle: { ...typography.title, color: colors.text, marginBottom: spacing.sm },
        emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
        fab: {
          position: 'absolute',
          right: spacing.lg,
          bottom: spacing.lg,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        },
        membersRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        memberAvatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.surfaceElevated,
          marginRight: -8,
          borderWidth: 2,
          borderColor: colors.surface,
          overflow: 'hidden',
        },
        membersLabel: { ...typography.caption, color: colors.textSecondary, marginLeft: spacing.lg },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.3)',
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [colors],
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <SmartImage uri={item.media?.url ?? ''} style={styles.tile} contentFit="cover" />
    ),
    [styles.tile],
  );

  const memberAvatars = useMemo(() => {
    if (!album) return [];
    const all = [
      { id: album.owner?.id, avatarUrl: album.owner?.avatarUrl, username: album.owner?.username },
      ...(album.members?.map((m: any) => m.user) ?? []),
    ];
    return all.slice(0, 5);
  }, [album]);

  if (albumQuery.isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{album?.name ?? 'Альбом'}</Text>
          <Text style={styles.headerSub}>{items.length} фото</Text>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={() => (navigation as any).push('AlbumSettings', { albumId })}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Members row */}
      <TouchableOpacity
        style={styles.membersRow}
        onPress={() => (navigation as any).push('AlbumMembers', { albumId, isOwner })}
        activeOpacity={0.7}
      >
        {memberAvatars.map((u: any, i: number) => (
          <View key={u?.id ?? i} style={[styles.memberAvatar, { zIndex: 10 - i }]}>
            {u?.avatarUrl ? (
              <SmartImage uri={u.avatarUrl} style={{ width: 28, height: 28, borderRadius: 14 }} />
            ) : (
              <View style={{ width: 28, height: 28, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="person" size={14} color={colors.textTertiary} />
              </View>
            )}
          </View>
        ))}
        <Text style={styles.membersLabel}>
          {(album?.members?.length ?? 0) + 1} участник{((album?.members?.length ?? 0) + 1) > 1 ? (((album?.members?.length ?? 0) + 1) > 4 ? 'ов' : 'а') : ''}
        </Text>
        <View style={{ flex: 1 }} />
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={64} color={colors.textTertiary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Пока пусто</Text>
          <Text style={styles.emptyText}>
            {canEdit ? 'Нажмите + чтобы добавить фото или видео' : 'В этом альбоме пока нет медиа'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id}
          numColumns={COLS}
          columnWrapperStyle={{ gap: GRID_GAP }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={5}
        />
      )}

      {canEdit && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + spacing.lg }]}
          onPress={pickMedia}
          activeOpacity={0.8}
        >
          {addItemMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="add" size={28} color="#FFF" />
          )}
        </TouchableOpacity>
      )}

      {addItemMutation.isPending && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={{ color: '#FFF', marginTop: 8 }}>Загрузка...</Text>
        </View>
      )}
    </View>
  );
};
