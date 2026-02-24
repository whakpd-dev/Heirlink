import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNetInfo } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typography } from '../../theme';
import { apiService } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { enqueuePostUpload } from '../../services/uploadQueue';
import { SmartImage } from '../../components/SmartImage';

/**
 * Экран создания поста — выбор медиа, подпись, публикация
 */
export const CreateScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const netInfo = useNetInfo();
  const queryClient = useQueryClient();
  const MAX_PHOTOS = 10;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
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
        headerButton: {
          padding: spacing.sm,
        },
        title: {
          ...typography.bodyBold,
          color: colors.text,
        },
        publishButton: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
        publishDisabled: {
          opacity: 0.5,
        },
        publishText: {
          ...typography.bodyBold,
          color: colors.primary,
        },
        publishTextDisabled: {
          color: colors.textTertiary,
        },
        scroll: {
          flex: 1,
        },
        scrollContent: {
          padding: spacing.lg,
        },
        mediaArea: {
          width: '100%',
          aspectRatio: 1,
          borderRadius: radius.lg,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          marginBottom: spacing.lg,
        },
        mediaPlaceholder: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.border,
          borderRadius: radius.lg,
        },
        mediaIconWrap: {
          marginBottom: spacing.md,
        },
        mediaLabel: {
          ...typography.bodyBold,
          color: colors.textSecondary,
        },
        mediaHint: {
          ...typography.captionMuted,
          color: colors.textTertiary,
          marginTop: spacing.xs,
        },
        previewImage: {
          width: '100%',
          height: '100%',
        },
        thumbStrip: {
          maxHeight: 80,
          marginBottom: spacing.md,
        },
        thumbStripContent: {
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
          alignItems: 'center',
        },
        thumbWrap: {
          width: 64,
          height: 64,
          borderRadius: radius.sm,
          overflow: 'hidden',
          position: 'relative',
        },
        thumb: {
          width: '100%',
          height: '100%',
        },
        thumbRemove: {
          position: 'absolute',
          top: -4,
          right: -4,
        },
        thumbAdd: {
          width: 64,
          height: 64,
          borderRadius: radius.sm,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        actions: {
          flexDirection: 'row',
          gap: spacing.lg,
          marginBottom: spacing.xl,
        },
        actionButton: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
        },
        actionLabel: {
          ...typography.bodyBold,
          color: colors.primary,
        },
        captionSection: {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.lg,
        },
        captionInput: {
          ...typography.body,
          color: colors.text,
          minHeight: 80,
          padding: 0,
        },
        captionCount: {
          ...typography.captionMuted,
          color: colors.textTertiary,
          textAlign: 'right',
          marginTop: spacing.sm,
        },
        options: {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          overflow: 'hidden',
        },
        optionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          gap: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        optionText: {
          flex: 1,
          ...typography.body,
          color: colors.text,
        },
      }),
    [colors],
  );
  const [caption, setCaption] = useState('');
  const [selectedUris, setSelectedUris] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const compressImage = useCallback(async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Доступ к галерее',
        'HeirLink нужен доступ к галерее для выбора фото. Откройте настройки чтобы разрешить доступ.',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Настройки', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: Math.max(1, MAX_PHOTOS - selectedUris.length),
    });
    if (!result.canceled && result.assets.length > 0) {
      const newUris = result.assets.map((a) => a.uri);
      setSelectedUris((prev) => [...prev, ...newUris].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (selectedUris.length >= MAX_PHOTOS) {
      Alert.alert('Лимит', `Можно добавить до ${MAX_PHOTOS} фото.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Доступ к камере',
        'HeirLink нужен доступ к камере для создания фото. Откройте настройки чтобы разрешить доступ.',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Настройки', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedUris((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
    }
  };

  const removePhoto = (index: number) => {
    setSelectedUris((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    navigation.goBack();
  };

  const handlePublish = async () => {
    if (selectedUris.length === 0) return;
    if (netInfo.isConnected === false) {
      await enqueuePostUpload({ caption: caption.trim() || undefined, mediaUris: selectedUris });
      setSelectedUris([]);
      setCaption('');
      showToast('Нет сети. Пост будет опубликован при подключении.');
      return;
    }
    setPublishing(true);
    setUploadProgress(0);
    try {
      const media: { url: string; type: 'photo' }[] = [];
      for (const uri of selectedUris) {
        const preparedUri = await compressImage(uri);
        const { url } = await apiService.uploadFile(preparedUri, 'photo');
        media.push({ url, type: 'photo' });
        setUploadProgress((c) => c + 1);
      }
      await apiService.createPost({
        caption: caption.trim() || undefined,
        media,
      });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['profilePosts'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['savedPosts'] });
      setSelectedUris([]);
      setCaption('');
      navigation.goBack();
      showToast('Пост опубликован');
    } catch (err: unknown) {
      const ax = err && typeof err === 'object' && 'response' in err ? (err as { response?: { data?: { message?: string }; status?: number } }) : null;
      const serverMsg = ax?.response?.data?.message;
      const status = ax?.response?.status;
      let userMsg = serverMsg || 'Не удалось опубликовать пост.';
      const errMsg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
      if (status === 404 || status === 502 || errMsg.includes('Network')) {
        userMsg += ' Проверьте, что сервер запущен и доступен по адресу из настроек.';
      } else {
        userMsg += ' Проверьте интернет и попробуйте снова.';
      }
      Alert.alert('Ошибка', userMsg);
    } finally {
      setPublishing(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerButton} onPress={handleClose} activeOpacity={0.8}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Новая публикация</Text>
        <TouchableOpacity
          style={[styles.publishButton, (selectedUris.length === 0 || publishing) && styles.publishDisabled]}
          onPress={handlePublish}
          disabled={selectedUris.length === 0 || publishing}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.publishText,
              (selectedUris.length === 0 || publishing) && styles.publishTextDisabled,
            ]}
          >
            {publishing
              ? uploadProgress > 0
                ? `Публикация… (${uploadProgress}/${selectedUris.length})`
                : 'Публикация…'
              : 'Опубликовать'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Область медиа */}
        <TouchableOpacity
          style={styles.mediaArea}
          onPress={pickImage}
          activeOpacity={0.9}
        >
          {selectedUris.length > 0 ? (
            <SmartImage uri={selectedUris[0]} style={styles.previewImage} />
          ) : (
            <View style={styles.mediaPlaceholder}>
              <View style={styles.mediaIconWrap}>
                <Ionicons name="images-outline" size={48} color={colors.textTertiary} />
              </View>
              <Text style={styles.mediaLabel}>Добавить фото</Text>
              <Text style={styles.mediaHint}>До {MAX_PHOTOS} фото. Нажмите или выберите ниже</Text>
            </View>
          )}
        </TouchableOpacity>
        {selectedUris.length > 0 && (
          <ScrollView
            horizontal
            style={styles.thumbStrip}
            contentContainerStyle={styles.thumbStripContent}
            showsHorizontalScrollIndicator={false}
          >
            {selectedUris.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.thumbWrap}>
                <SmartImage uri={uri} style={styles.thumb} />
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => removePhoto(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={24} color={colors.like} />
                </TouchableOpacity>
              </View>
            ))}
            {selectedUris.length < MAX_PHOTOS && (
              <TouchableOpacity style={styles.thumbAdd} onPress={pickImage} activeOpacity={0.8}>
                <Ionicons name="add" size={28} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {/* Кнопки: галерея / камера */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={pickImage} activeOpacity={0.8}>
            <Ionicons name="images-outline" size={24} color={colors.primary} />
            <Text style={styles.actionLabel}>Галерея</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={takePhoto} activeOpacity={0.8}>
            <Ionicons name="camera-outline" size={24} color={colors.primary} />
            <Text style={styles.actionLabel}>Камера</Text>
          </TouchableOpacity>
        </View>

        {/* Подпись */}
        <View style={styles.captionSection}>
          <TextInput
            style={styles.captionInput}
            placeholder="Добавьте подпись..."
            placeholderTextColor={colors.textTertiary}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={2200}
          />
          <Text style={styles.captionCount}>{caption.length}/2200</Text>
        </View>

        {/* Доп. опции (заглушки) */}
        <View style={styles.options}>
          <TouchableOpacity style={styles.optionRow} activeOpacity={0.8}>
            <Ionicons name="location-outline" size={22} color={colors.text} />
            <Text style={styles.optionText}>Добавить место</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionRow} activeOpacity={0.8}>
            <Ionicons name="people-outline" size={22} color={colors.text} />
            <Text style={styles.optionText}>Отметить людей</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
