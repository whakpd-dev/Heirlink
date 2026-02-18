import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

/**
 * Экран «О приложении»: название, версия, краткое описание
 */
export const AboutScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>О приложении</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.appName, { color: colors.text }]}>HeirLink</Text>
        <Text style={[styles.version, { color: colors.textSecondary }]}>Версия {version}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Социальная платформа для фото и видео с ИИ-функциями: умный альбом, истории, лента и профили.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.title },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  version: {
    ...typography.caption,
    marginBottom: spacing.xl,
  },
  description: {
    ...typography.body,
    lineHeight: 22,
  },
});
