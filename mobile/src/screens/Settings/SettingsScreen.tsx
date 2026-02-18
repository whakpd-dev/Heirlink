import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { AppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';

const SETTINGS_GROUPS = [
  {
    title: 'Аккаунт',
    items: [
      { icon: 'person-outline', label: 'Редактировать профиль', key: 'edit' },
      { icon: 'lock-closed-outline', label: 'Пароль и безопасность', key: 'password' },
      { icon: 'mail-outline', label: 'Email и уведомления', key: 'email' },
    ],
  },
  {
    title: 'Конфиденциальность',
    items: [
      { icon: 'eye-outline', label: 'Приватность аккаунта', key: 'privacy', hasSwitch: true },
      { icon: 'people-outline', label: 'Блокировка', key: 'blocked' },
    ],
  },
  {
    title: 'Приложение',
    items: [
      { icon: 'sparkles', label: 'Grok AI', key: 'grok' },
      { icon: 'notifications-outline', label: 'Push-уведомления', key: 'push', hasSwitch: true },
      { icon: 'moon-outline', label: 'Тёмная тема', key: 'dark', hasSwitch: true },
      { icon: 'information-circle-outline', label: 'О приложении', key: 'about' },
    ],
  },
];

/**
 * Экран настроек
 */
export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const { colors, isDark, setTheme } = useTheme();
  const [privateAccount, setPrivateAccount] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(true);

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
        scroll: { flex: 1 },
        scrollContent: { padding: spacing.lg },
        group: { marginBottom: spacing.xl },
        groupTitle: {
          ...typography.caption,
          color: colors.textSecondary,
          marginBottom: spacing.sm,
          marginLeft: spacing.sm,
        },
        groupContent: {
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
        rowIcon: { marginRight: spacing.md },
        rowLabel: { flex: 1, ...typography.body, color: colors.text },
        logoutButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          marginTop: spacing.lg,
        },
        logoutText: { ...typography.bodyBold, color: colors.like },
        version: {
          ...typography.captionMuted,
          color: colors.textTertiary,
          textAlign: 'center',
          marginTop: spacing.xl,
        },
      }),
    [colors],
  );

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Настройки</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {SETTINGS_GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.groupContent}>
              {group.items.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.row}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (item.key === 'edit') {
                      (navigation.getParent() as any)?.navigate('ProfileTab', { screen: 'Profile' });
                      navigation.goBack();
                      return;
                    }
                    if (item.key === 'about') {
                      navigation.navigate('About' as never);
                      return;
                    }
                    if (item.key === 'grok') {
                      navigation.navigate('GrokChat' as never);
                      return;
                    }
                    if (!item.hasSwitch) Alert.alert('Скоро', 'Раздел в разработке.');
                  }}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={22}
                    color={colors.text}
                    style={styles.rowIcon}
                  />
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.hasSwitch && (
                    <Switch
                      value={
                        item.key === 'privacy'
                          ? privateAccount
                          : item.key === 'push'
                            ? pushEnabled
                            : isDark
                      }
                      onValueChange={(v) => {
                        if (item.key === 'privacy') setPrivateAccount(v);
                        if (item.key === 'push') setPushEnabled(v);
                        if (item.key === 'dark') setTheme(v ? 'dark' : 'light');
                      }}
                      trackColor={{ false: colors.border, true: colors.primaryLight }}
                      thumbColor={colors.surface}
                    />
                  )}
                  {!item.hasSwitch && (
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={22} color={colors.like} />
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>

        <Text style={styles.version}>HeirLink v1.0.0</Text>
      </ScrollView>
    </View>
  );
};
