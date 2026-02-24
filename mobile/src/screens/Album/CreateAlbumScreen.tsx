import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';

export const CreateAlbumScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);

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
        backBtn: { width: 40, height: 40, justifyContent: 'center' },
        headerTitle: { ...typography.title, color: colors.text },
        createBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
        createBtnText: { ...typography.bodyBold, color: colors.primary },
        createBtnDisabled: { opacity: 0.4 },
        body: { padding: spacing.lg },
        label: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg },
        input: {
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          ...typography.body,
          color: colors.text,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginTop: spacing.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        rowLeft: { flex: 1, marginRight: spacing.md },
        rowTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
        rowSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
        hint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xl, textAlign: 'center', paddingHorizontal: spacing.lg },
      }),
    [colors],
  );

  const createMutation = useMutation({
    mutationFn: () => apiService.createAlbum(name.trim(), isPrivate ? 'private' : 'public'),
    onSuccess: (album: any) => {
      queryClient.invalidateQueries({ queryKey: ['myAlbums'] });
      (navigation as any).replace('AlbumDetail', { albumId: album.id, albumName: album.name });
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось создать альбом'),
  });

  const canCreate = name.trim().length > 0 && !createMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Новый альбом</Text>
        <TouchableOpacity
          style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
          onPress={() => createMutation.mutate()}
          disabled={!canCreate}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.createBtnText}>Создать</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={[styles.label, { marginTop: 0 }]}>Название</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Семья, Путешествия, Друзья..."
          placeholderTextColor={colors.textTertiary}
          maxLength={50}
          autoFocus
        />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>
              <Ionicons name={isPrivate ? 'lock-closed' : 'earth'} size={16} /> {isPrivate ? 'Приватный' : 'Публичный'}
            </Text>
            <Text style={styles.rowSubtitle}>
              {isPrivate
                ? 'Видят только вы и участники'
                : 'Виден всем на вашем профиле'}
            </Text>
          </View>
          <Switch
            value={!isPrivate}
            onValueChange={(v) => setIsPrivate(!v)}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={colors.surface}
          />
        </View>

        <Text style={styles.hint}>
          Вы сможете добавлять фото и видео, а также приглашать людей для совместного наполнения альбома
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};
