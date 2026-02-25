import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { SmartImage } from '../../components/SmartImage';

type UserItem = { id: string; username: string; avatarUrl?: string | null };

export const SelectUsersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();

  const initialIds: string[] = route.params?.selectedIds ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ['searchUsersTag', debouncedQuery],
    enabled: debouncedQuery.length > 0,
    queryFn: () => apiService.searchUsers(debouncedQuery, 1, 30),
  });

  const suggestionsQuery = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => apiService.getSuggestions(30),
    staleTime: 60_000,
  });

  const users: UserItem[] = debouncedQuery
    ? (searchQuery.data?.items ?? [])
    : (suggestionsQuery.data?.items ?? []);
  const isLoading = debouncedQuery ? searchQuery.isLoading : suggestionsQuery.isLoading;

  const toggleUser = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 20) next.add(id);
      return next;
    });
  }, []);

  const handleDone = useCallback(() => {
    const ids = Array.from(selected);
    route.params?.onSelect?.(ids);
    navigation.goBack();
  }, [selected, route.params, navigation]);

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
        doneText: { ...typography.bodyBold, color: colors.primary },
        searchBar: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          margin: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          gap: spacing.sm,
        },
        searchInput: { flex: 1, ...typography.body, color: colors.text, padding: 0 },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
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
        username: { ...typography.body, color: colors.text, flex: 1 },
        checkBox: {
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        checkBoxSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
      }),
    [colors],
  );

  const renderItem = useCallback(
    ({ item }: { item: UserItem }) => {
      const isSelected = selected.has(item.id);
      return (
        <TouchableOpacity style={styles.row} onPress={() => toggleUser(item.id)} activeOpacity={0.7}>
          <View style={styles.avatar}>
            {item.avatarUrl ? (
              <SmartImage uri={item.avatarUrl} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={22} color={colors.textTertiary} />
            )}
          </View>
          <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
          <View style={[styles.checkBox, isSelected && styles.checkBoxSelected]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
          </View>
        </TouchableOpacity>
      );
    },
    [styles, colors, selected, toggleUser],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Отметить людей</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleDone} activeOpacity={0.8}>
          <Text style={styles.doneText}>Готово</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};
