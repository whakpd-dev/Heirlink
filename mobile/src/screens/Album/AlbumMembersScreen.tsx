import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { SmartImage } from '../../components/SmartImage';
import { RootState } from '../../store/store';

export const AlbumMembersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const authUser = useSelector((state: RootState) => state.auth.user);

  const albumId: string = route.params?.albumId;
  const isOwner: boolean = route.params?.isOwner ?? false;
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const membersQuery = useQuery({
    queryKey: ['albumMembers', albumId],
    queryFn: () => apiService.getAlbumMembers(albumId),
  });

  const albumQuery = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => apiService.getAlbum(albumId),
    staleTime: 60_000,
  });

  const searchUsersQuery = useQuery({
    queryKey: ['searchUsers', searchQuery],
    queryFn: () => apiService.searchUsers(searchQuery),
    enabled: searchQuery.length >= 2,
    staleTime: 10_000,
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) => apiService.addAlbumMember(albumId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albumMembers', albumId] });
      queryClient.invalidateQueries({ queryKey: ['album', albumId] });
      setSearchQuery('');
      setShowSearch(false);
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось добавить участника'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => apiService.removeAlbumMember(albumId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['albumMembers', albumId] });
      queryClient.invalidateQueries({ queryKey: ['album', albumId] });
    },
  });

  const handleRemove = useCallback(
    (userId: string, username: string) => {
      const isSelf = userId === authUser?.id;
      Alert.alert(
        isSelf ? 'Покинуть альбом?' : 'Удалить участника?',
        isSelf ? 'Вы больше не сможете добавлять контент' : `Удалить ${username} из альбома?`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: isSelf ? 'Покинуть' : 'Удалить',
            style: 'destructive',
            onPress: () => {
              removeMemberMutation.mutate(userId);
              if (isSelf) navigation.goBack();
            },
          },
        ],
      );
    },
    [authUser?.id, removeMemberMutation, navigation],
  );

  const members = membersQuery.data ?? [];
  const owner = albumQuery.data?.owner;
  const existingIds = new Set([owner?.id, ...members.map((m: any) => m.userId)]);
  const searchResults = (searchUsersQuery.data?.items ?? []).filter((u: any) => !existingIds.has(u.id));

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
        headerTitle: { ...typography.title, color: colors.text, flex: 1, marginHorizontal: spacing.sm },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, overflow: 'hidden', marginRight: spacing.md },
        avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
        info: { flex: 1 },
        username: { ...typography.bodyBold, color: colors.text },
        role: { ...typography.caption, color: colors.textSecondary },
        removeBtn: { paddingHorizontal: spacing.sm },
        addRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        searchInput: {
          flex: 1,
          backgroundColor: colors.background,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          ...typography.body,
          color: colors.text,
        },
        sectionLabel: { ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
        inviteBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
        inviteBtnText: { ...typography.caption, color: '#FFF', fontWeight: '600' },
      }),
    [colors],
  );

  const renderMember = useCallback(
    ({ item }: { item: any }) => {
      const user = item.user;
      const canRemove = isOwner || item.userId === authUser?.id;
      return (
        <View style={styles.row}>
          {user?.avatarUrl ? (
            <View style={styles.avatar}>
              <SmartImage uri={user.avatarUrl} style={{ width: 44, height: 44 }} />
            </View>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color={colors.textTertiary} />
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.role}>{item.role === 'editor' ? 'Редактор' : 'Читатель'}</Text>
          </View>
          {canRemove && (
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(item.userId, user?.username)}>
              <Ionicons name="close-circle" size={22} color={colors.like} />
            </TouchableOpacity>
          )}
        </View>
      );
    },
    [styles, colors, isOwner, authUser?.id, handleRemove],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Участники</Text>
        {isOwner && (
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name={showSearch ? 'close' : 'person-add-outline'} size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {showSearch && (
        <View>
          <View style={styles.addRow}>
            <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: spacing.sm }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск пользователей..."
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
          </View>
          {searchResults.map((u: any) => (
            <View key={u.id} style={styles.row}>
              {u.avatarUrl ? (
                <View style={styles.avatar}>
                  <SmartImage uri={u.avatarUrl} style={{ width: 44, height: 44 }} />
                </View>
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color={colors.textTertiary} />
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.username}>{u.username}</Text>
              </View>
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={() => addMemberMutation.mutate(u.id)}
                disabled={addMemberMutation.isPending}
              >
                <Text style={styles.inviteBtnText}>Добавить</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Owner */}
      {owner && (
        <>
          <Text style={styles.sectionLabel}>Владелец</Text>
          <View style={styles.row}>
            {owner.avatarUrl ? (
              <View style={styles.avatar}>
                <SmartImage uri={owner.avatarUrl} style={{ width: 44, height: 44 }} />
              </View>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={20} color={colors.textTertiary} />
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.username}>{owner.username}</Text>
              <Text style={styles.role}>Владелец</Text>
            </View>
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>Участники ({members.length})</Text>
      {members.length === 0 ? (
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            {isOwner ? 'Пригласите людей для совместного наполнения' : 'Пока нет участников'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMember}
          keyExtractor={(item: any) => item.id}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};
