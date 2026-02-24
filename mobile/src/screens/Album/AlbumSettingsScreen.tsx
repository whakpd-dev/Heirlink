import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';

export const AlbumSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const albumId: string = route.params?.albumId;

  const albumQuery = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => apiService.getAlbum(albumId),
  });

  const album = albumQuery.data;
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [initialized, setInitialized] = useState(false);

  if (album && !initialized) {
    setName(album.name);
    setIsPrivate(album.visibility === 'private');
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      apiService.updateAlbum(albumId, {
        name: name.trim(),
        visibility: isPrivate ? 'private' : 'public',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album', albumId] });
      queryClient.invalidateQueries({ queryKey: ['myAlbums'] });
      navigation.goBack();
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось сохранить'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiService.deleteAlbum(albumId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAlbums'] });
      navigation.goBack();
      navigation.goBack();
    },
    onError: () => Alert.alert('Ошибка', 'Не удалось удалить'),
  });

  const handleDelete = () => {
    Alert.alert('Удалить альбом?', 'Все фото и видео будут удалены навсегда', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  const canSave = name.trim().length > 0 && !saveMutation.isPending;

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
        saveBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
        saveBtnText: { ...typography.bodyBold, color: colors.primary },
        saveBtnDisabled: { opacity: 0.4 },
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
        deleteBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          marginTop: spacing.xl * 2,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.like,
        },
        deleteBtnText: { ...typography.bodyBold, color: colors.like },
      }),
    [colors],
  );

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
        <Text style={styles.headerTitle}>Настройки</Text>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={() => saveMutation.mutate()}
          disabled={!canSave}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.saveBtnText}>Сохранить</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <Text style={[styles.label, { marginTop: 0 }]}>Название</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Название альбома"
          placeholderTextColor={colors.textTertiary}
          maxLength={50}
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

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={20} color={colors.like} />
          <Text style={styles.deleteBtnText}>Удалить альбом</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
