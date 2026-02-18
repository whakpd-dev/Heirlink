import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { setUser } from '../../store/authSlice';
import { RootState, AppDispatch } from '../../store/store';

const BIO_MAX = 150;

/**
 * Редактирование профиля: аватар и био
 */
export const EditProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useSelector((state: RootState) => state.auth.user);
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [bio, setBio] = useState(authUser?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(authUser?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setBio(authUser?.bio ?? '');
    setAvatarUrl(authUser?.avatarUrl ?? null);
  }, [authUser?.id, authUser?.bio, authUser?.avatarUrl]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Доступ', 'Нужен доступ к галерее для выбора фото.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const { url } = await apiService.uploadFile(
        result.assets[0].uri,
        'photo',
        undefined,
        'avatars',
      );
      setAvatarUrl(url);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      Alert.alert('Ошибка', msg ?? 'Не удалось загрузить фото.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await apiService.updateProfile({
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
      });
      if (user) dispatch(setUser(user));
      showToast('Профиль обновлён');
      navigation.goBack();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      Alert.alert('Ошибка', msg ?? 'Не удалось сохранить профиль.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerBtnLeft} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Редактировать профиль</Text>
        <TouchableOpacity
          style={styles.headerBtnRight}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.saveText, { color: colors.primary }]}>Сохранить</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={pickAvatar}
          disabled={uploading}
          activeOpacity={0.9}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
              <Ionicons name="person" size={48} color={colors.textTertiary} />
            </View>
          )}
          {uploading && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color="#FFF" />
            </View>
          )}
          <View style={[styles.changePhotoBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.changePhotoText}>Изменить фото</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.fieldWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>О себе</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
            placeholder="Расскажите о себе"
            placeholderTextColor={colors.textTertiary}
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={BIO_MAX}
          />
          <Text style={[styles.count, { color: colors.textTertiary }]}>{bio.length}/{BIO_MAX}</Text>
        </View>
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
  headerBtnLeft: { minWidth: 80, alignItems: 'flex-start' },
  headerBtnRight: { minWidth: 80, alignItems: 'flex-end' },
  title: { ...typography.title },
  saveText: { ...typography.bodyBold },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  changePhotoText: {
    ...typography.caption,
    color: '#FFF',
    fontWeight: '600',
  },
  fieldWrap: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    minHeight: 80,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  count: {
    ...typography.captionMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
});
