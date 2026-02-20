import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';
import { apiService } from '../../services/api';
import { SmartImage } from '../../components/SmartImage';

type Params = { userId: string; mode: 'followers' | 'following'; username?: string };
type UserItem = { id: string; username: string; avatarUrl: string | null };

export const FollowListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ FollowList: Params }, 'FollowList'>>();
  const { colors } = useTheme();
  const { userId, mode, username } = route.params;
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [mode, userId, page],
    queryFn: async () => {
      const res = mode === 'followers'
        ? await apiService.getFollowers(userId, page, 30)
        : await apiService.getFollowing(userId, page, 30);
      return res;
    },
  });

  const items = (query.data?.items ?? []) as UserItem[];
  const title = mode === 'followers' ? 'Подписчики' : 'Подписки';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          {username && <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>{username}</Text>}
        </View>
        <View style={styles.backBtn} />
      </View>

      {query.isLoading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => (navigation as any).push('Profile', { userId: item.id })}
              activeOpacity={0.7}
            >
              <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                {item.avatarUrl ? (
                  <SmartImage uri={item.avatarUrl} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={22} color={colors.textTertiary} />
                )}
              </View>
              <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                {mode === 'followers' ? 'Нет подписчиков' : 'Нет подписок'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.body, fontWeight: '600' },
  headerSubtitle: { ...typography.caption, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { ...typography.body },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarImg: { width: 44, height: 44 },
  username: { ...typography.body, fontWeight: '600', flex: 1 },
});
