import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography } from '../theme';

/**
 * Верхняя панель ленты — логотип, активность (сердечко), чаты
 */
export const FeedHeader: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, spacing.md), backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Text style={[styles.logo, { color: colors.text }]}>HeirLink</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.iconButton}
          activeOpacity={0.7}
          onPress={() => (navigation as any).navigate('Activity')}
        >
          <Ionicons name="heart-outline" size={26} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          activeOpacity={0.7}
          onPress={() => (navigation as any).getParent()?.navigate('ChatTab', { screen: 'ChatList' })}
        >
          <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logo: {
    ...typography.title,
    letterSpacing: -0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
});
