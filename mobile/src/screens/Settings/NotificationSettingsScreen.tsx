import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';

export const NotificationSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => apiService.getMe(),
  });

  const me: any = meQuery.data;

  const [notifyLikes, setNotifyLikes] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyFollows, setNotifyFollows] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me) {
      setNotifyLikes(me.notifyLikes ?? true);
      setNotifyComments(me.notifyComments ?? true);
      setNotifyFollows(me.notifyFollows ?? true);
    }
  }, [me]);

  const handleToggle = useCallback(
    async (field: 'notifyLikes' | 'notifyComments' | 'notifyFollows', value: boolean) => {
      const prev = { notifyLikes, notifyComments, notifyFollows };
      if (field === 'notifyLikes') setNotifyLikes(value);
      if (field === 'notifyComments') setNotifyComments(value);
      if (field === 'notifyFollows') setNotifyFollows(value);
      setSaving(true);
      try {
        await apiService.updateNotificationSettings({ [field]: value });
        queryClient.invalidateQueries({ queryKey: ['me'] });
      } catch {
        if (field === 'notifyLikes') setNotifyLikes(prev.notifyLikes);
        if (field === 'notifyComments') setNotifyComments(prev.notifyComments);
        if (field === 'notifyFollows') setNotifyFollows(prev.notifyFollows);
        Alert.alert('Ошибка', 'Не удалось сохранить настройку');
      } finally {
        setSaving(false);
      }
    },
    [notifyLikes, notifyComments, notifyFollows, queryClient],
  );

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
        content: { padding: spacing.lg },
        section: { marginBottom: spacing.xl },
        sectionTitle: {
          ...typography.caption,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
          marginLeft: spacing.sm,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          overflow: 'hidden',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowLabel: { flex: 1, ...typography.body, color: colors.text },
        emailRow: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
        },
        emailIcon: { marginRight: spacing.md },
        emailLabel: { ...typography.caption, color: colors.textSecondary },
        emailValue: { ...typography.body, color: colors.text },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
      }),
    [colors],
  );

  if (meQuery.isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Email и уведомления</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email</Text>
          <View style={styles.card}>
            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.emailIcon} />
              <View>
                <Text style={styles.emailLabel}>Текущий email</Text>
                <Text style={styles.emailValue}>{me?.email ?? '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Уведомления</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>О лайках</Text>
              <Switch
                value={notifyLikes}
                onValueChange={(v) => handleToggle('notifyLikes', v)}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>О комментариях</Text>
              <Switch
                value={notifyComments}
                onValueChange={(v) => handleToggle('notifyComments', v)}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={colors.surface}
              />
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>О подписчиках</Text>
              <Switch
                value={notifyFollows}
                onValueChange={(v) => handleToggle('notifyFollows', v)}
                disabled={saving}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={colors.surface}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
