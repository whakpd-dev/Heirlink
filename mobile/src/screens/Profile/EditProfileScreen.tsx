import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Switch,
  Platform,
  ActionSheetIOS,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { apiService } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { setUser } from '../../store/authSlice';
import { RootState, AppDispatch } from '../../store/store';

const BIO_MAX = 150;
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export const EditProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const dispatch = useDispatch<AppDispatch>();
  const authUser = useSelector((state: RootState) => state.auth.user);
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(authUser?.displayName ?? '');
  const [username, setUsername] = useState(authUser?.username ?? '');
  const [bio, setBio] = useState(authUser?.bio ?? '');
  const [website, setWebsite] = useState(authUser?.website ?? '');
  const [isPrivate, setIsPrivate] = useState(authUser?.isPrivate ?? false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(authUser?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [focusField, setFocusField] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(authUser?.displayName ?? '');
    setUsername(authUser?.username ?? '');
    setBio(authUser?.bio ?? '');
    setWebsite(authUser?.website ?? '');
    setIsPrivate(authUser?.isPrivate ?? false);
    setAvatarUrl(authUser?.avatarUrl ?? null);
  }, [authUser?.id]);

  const hasChanges = useMemo(() => {
    if (!authUser) return false;
    return (
      displayName !== (authUser.displayName ?? '') ||
      username !== (authUser.username ?? '') ||
      bio !== (authUser.bio ?? '') ||
      website !== (authUser.website ?? '') ||
      isPrivate !== (authUser.isPrivate ?? false) ||
      avatarUrl !== (authUser.avatarUrl ?? null)
    );
  }, [authUser, displayName, username, bio, website, isPrivate, avatarUrl]);

  const usernameError = useMemo(() => {
    const u = username.trim().toLowerCase();
    if (!u) return '';
    if (u.length < 3) return 'Минимум 3 символа';
    if (!USERNAME_RE.test(u)) return 'Только латиница, цифры и _';
    return '';
  }, [username]);

  const showAvatarOptions = useCallback(() => {
    const options = avatarUrl
      ? ['Выбрать из галереи', 'Сделать фото', 'Удалить фото', 'Отмена']
      : ['Выбрать из галереи', 'Сделать фото', 'Отмена'];
    const cancelIdx = options.length - 1;
    const destructiveIdx = avatarUrl ? 2 : undefined;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx, destructiveButtonIndex: destructiveIdx },
        (idx) => {
          if (idx === 0) pickImage('gallery');
          else if (idx === 1) pickImage('camera');
          else if (idx === 2 && avatarUrl) setAvatarUrl(null);
        },
      );
    } else {
      Alert.alert('Фото профиля', undefined, [
        { text: 'Выбрать из галереи', onPress: () => pickImage('gallery') },
        { text: 'Сделать фото', onPress: () => pickImage('camera') },
        ...(avatarUrl
          ? [{ text: 'Удалить фото', style: 'destructive' as const, onPress: () => setAvatarUrl(null) }]
          : []),
        { text: 'Отмена', style: 'cancel' as const },
      ]);
    }
  }, [avatarUrl]);

  const pickImage = async (source: 'gallery' | 'camera') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Доступ', 'Нужен доступ к камере');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Доступ', 'Нужен доступ к галерее');
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const { url } = await apiService.uploadFile(result.assets[0].uri, 'photo', undefined, 'avatars');
      setAvatarUrl(url);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (usernameError) {
      Alert.alert('Ошибка', usernameError);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (displayName !== (authUser?.displayName ?? '')) payload.displayName = displayName.trim();
      if (username !== (authUser?.username ?? '')) payload.username = username.trim().toLowerCase();
      if (bio !== (authUser?.bio ?? '')) payload.bio = bio.trim();
      if (website !== (authUser?.website ?? '')) payload.website = website.trim();
      if (isPrivate !== (authUser?.isPrivate ?? false)) payload.isPrivate = isPrivate;
      if (avatarUrl !== (authUser?.avatarUrl ?? null)) payload.avatarUrl = avatarUrl || '';

      const user = await apiService.updateProfile(payload);
      if (user) dispatch(setUser(user));
      showToast('Профиль обновлён');
      navigation.goBack();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      Alert.alert('Ошибка', typeof msg === 'string' ? msg : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert('Несохранённые изменения', 'Вы уверены, что хотите выйти без сохранения?', [
        { text: 'Остаться', style: 'cancel' },
        { text: 'Выйти', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        headerBtn: { width: 60 },
        headerTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
        saveBtn: {
          paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
        },
        saveBtnActive: { backgroundColor: colors.primary },
        saveBtnDisabled: { backgroundColor: colors.border },
        saveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

        scroll: { flex: 1 },
        scrollContent: { paddingBottom: 40 },

        avatarSection: { alignItems: 'center', paddingVertical: 24, backgroundColor: colors.surface },
        avatarWrap: { position: 'relative', marginBottom: 12 },
        avatar: { width: 96, height: 96, borderRadius: 48 },
        avatarPlaceholder: {
          width: 96, height: 96, borderRadius: 48,
          backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center',
        },
        avatarOverlay: {
          ...StyleSheet.absoluteFillObject, borderRadius: 48,
          backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
        },
        cameraBadge: {
          position: 'absolute', bottom: 0, right: 0,
          width: 32, height: 32, borderRadius: 16,
          backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
          borderWidth: 3, borderColor: colors.surface,
        },
        changePhotoText: { fontSize: 14, fontWeight: '600', color: colors.primary },

        section: { marginTop: 12, backgroundColor: colors.surface },
        sectionHeader: {
          fontSize: 13, fontWeight: '500', color: colors.textSecondary, textTransform: 'uppercase',
          paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
          backgroundColor: colors.background, letterSpacing: 0.5,
        },

        fieldRow: {
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
          backgroundColor: colors.surface, minHeight: 52,
        },
        fieldLabel: { width: 110, fontSize: 15, color: colors.text, fontWeight: '400' },
        fieldInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0, textAlign: 'right' },
        fieldInputFocused: { color: colors.primary },
        fieldValue: { flex: 1, fontSize: 15, color: colors.textSecondary, textAlign: 'right' },

        bioRow: {
          paddingHorizontal: 16, paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        bioLabel: { fontSize: 15, color: colors.text, marginBottom: 8 },
        bioInput: {
          fontSize: 15, color: colors.text, minHeight: 60, textAlignVertical: 'top',
          paddingVertical: 0,
        },
        bioCounter: { fontSize: 12, color: colors.textTertiary, textAlign: 'right', marginTop: 6 },
        bioCounterWarn: { color: colors.like },

        switchRow: {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        switchLeft: { flex: 1, marginRight: 12 },
        switchLabel: { fontSize: 15, color: colors.text },
        switchHint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

        linkRow: {
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 16,
          borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
        linkRowLeft: { flexDirection: 'row', alignItems: 'center' },
        linkRowIcon: { marginRight: 12 },
        linkRowText: { fontSize: 15, color: colors.text },
        linkRowChevron: { marginLeft: 8 },

        errorHint: { fontSize: 12, color: colors.like, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, backgroundColor: colors.surface },
      }),
    [colors],
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={handleBack}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Редактировать</Text>
        <TouchableOpacity
          style={[s.saveBtn, hasChanges && !saving ? s.saveBtnActive : s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.saveBtnText}>Сохранить</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={s.avatarSection}>
            <TouchableOpacity style={s.avatarWrap} onPress={showAvatarOptions} disabled={uploading} activeOpacity={0.85}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatar} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Ionicons name="person" size={44} color={colors.primary} />
                </View>
              )}
              {uploading && (
                <View style={s.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              <View style={s.cameraBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={showAvatarOptions} disabled={uploading}>
              <Text style={s.changePhotoText}>Изменить фото</Text>
            </TouchableOpacity>
          </View>

          {/* Basic info */}
          <Text style={s.sectionHeader}>Основное</Text>
          <View style={s.section}>
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Имя</Text>
              <TextInput
                style={[s.fieldInput, focusField === 'displayName' && s.fieldInputFocused]}
                placeholder="Ваше имя"
                placeholderTextColor={colors.textTertiary}
                value={displayName}
                onChangeText={setDisplayName}
                maxLength={50}
                returnKeyType="next"
                autoCapitalize="words"
                onFocus={() => setFocusField('displayName')}
                onBlur={() => setFocusField(null)}
              />
            </View>

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Имя польз.</Text>
              <TextInput
                style={[s.fieldInput, focusField === 'username' && s.fieldInputFocused]}
                placeholder="username"
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30))}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => setFocusField('username')}
                onBlur={() => setFocusField(null)}
              />
            </View>
            {!!usernameError && focusField === 'username' && (
              <Text style={s.errorHint}>{usernameError}</Text>
            )}

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Сайт</Text>
              <TextInput
                style={[s.fieldInput, focusField === 'website' && s.fieldInputFocused]}
                placeholder="example.com"
                placeholderTextColor={colors.textTertiary}
                value={website}
                onChangeText={setWebsite}
                maxLength={100}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onFocus={() => setFocusField('website')}
                onBlur={() => setFocusField(null)}
              />
            </View>
          </View>

          {/* Bio */}
          <Text style={s.sectionHeader}>О себе</Text>
          <View style={s.section}>
            <View style={s.bioRow}>
              <TextInput
                style={[s.bioInput, focusField === 'bio' && { color: colors.primary }]}
                placeholder="Расскажите о себе..."
                placeholderTextColor={colors.textTertiary}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={BIO_MAX}
                onFocus={() => setFocusField('bio')}
                onBlur={() => setFocusField(null)}
              />
              <Text style={[s.bioCounter, bio.length > BIO_MAX - 20 && s.bioCounterWarn]}>
                {bio.length}/{BIO_MAX}
              </Text>
            </View>
          </View>

          {/* Privacy */}
          <Text style={s.sectionHeader}>Конфиденциальность</Text>
          <View style={s.section}>
            <View style={s.switchRow}>
              <View style={s.switchLeft}>
                <Text style={s.switchLabel}>Закрытый аккаунт</Text>
                <Text style={s.switchHint}>Только подтверждённые подписчики видят ваши посты</Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={isPrivate ? colors.primary : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Account actions */}
          <Text style={s.sectionHeader}>Аккаунт</Text>
          <View style={s.section}>
            <TouchableOpacity style={s.linkRow} onPress={() => navigation.navigate('ChangePassword' as never)}>
              <View style={s.linkRowLeft}>
                <Ionicons name="key-outline" size={20} color={colors.text} style={s.linkRowIcon} />
                <Text style={s.linkRowText}>Сменить пароль</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>

            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Email</Text>
              <Text style={s.fieldValue}>{authUser?.email ?? ''}</Text>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </View>
  );
};
