import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { SmartImage } from '../../components/SmartImage';

type BlockedUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
};

export const BlockedUsersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
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
        backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
        title: { ...typography.title, color: colors.text },
        emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
        emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.surface,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          marginRight: spacing.md,
        },
        avatarImage: { width: 44, height: 44, borderRadius: 22 },
        username: { ...typography.bodyBold, color: colors.text, flex: 1 },
        unblockBtn: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        unblockText: { ...typography.caption, color: colors.text },
      }),
    [colors],
  );

  const blockedQuery = useQuery({
    queryKey: ['blockedUsers'],
    queryFn: () => apiService.getBlockedUsers(),
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => apiService.unblockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockedUsers'] });
    },
    onError: () => {
      Alert.alert('Ошибка', 'Не удалось разблокировать пользователя');
    },
  });

  const handleUnblock = useCallback(
    (user: BlockedUser) => {
      Alert.alert(
        'Разблокировать',
        `Разблокировать @${user.username}?`,
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Разблокировать', onPress: () => unblockMutation.mutate(user.id) },
        ],
      );
    },
    [unblockMutation],
  );

  const blocked: BlockedUser[] = blockedQuery.data ?? [];

  const renderItem = useCallback(
    ({ item }: { item: BlockedUser }) => (
      <View style={styles.row}>
        <View style={styles.avatar}>
          {item.avatarUrl ? (
            <SmartImage uri={item.avatarUrl} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={22} color={colors.textTertiary} />
          )}
        </View>
        <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
        <TouchableOpacity
          style={styles.unblockBtn}
          onPress={() => handleUnblock(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.unblockText}>Разблокировать</Text>
        </TouchableOpacity>
      </View>
    ),
    [styles, colors, handleUnblock],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Заблокированные</Text>
        <View style={styles.backButton} />
      </View>

      {blockedQuery.isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : blocked.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Нет заблокированных пользователей</Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
};
