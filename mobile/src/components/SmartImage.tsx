import React from 'react';
import { View, ImageStyle, StyleProp } from 'react-native';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import { useTheme } from '../context/ThemeContext';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ExpoImageProps['contentFit'];
  onLoad?: () => void;
};

/** Превращает относительный путь (например /api/uploads/...) в полный URL. */
function resolveUri(uri: string): string {
  if (!uri || typeof uri !== 'string') return '';
  const trimmed = uri.trim();
  
  // Если уже полный URL, заменяем localhost на правильный домен
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Заменяем localhost:3000 на правильный домен для продакшена
    if (trimmed.includes('localhost:3000')) {
      return trimmed.replace(/http:\/\/localhost:3000/g, 'https://api.whakcomp.ru');
    }
    return trimmed;
  }
  
  // Относительный путь - добавляем базовый URL
  const base = (API_URL || '').replace(/\/$/, '');
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/** Проверяет, что URI загружаем через сеть (http/https). ph:// и file:// на iOS/Android не поддерживаются. */
function isLoadableUri(uri: string): boolean {
  if (!uri || typeof uri !== 'string') return false;
  const lower = uri.trim().toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

export const SmartImage = React.memo<Props>(({ uri, style, contentFit = 'cover', onLoad }) => {
  const { colors } = useTheme();
  const resolved = resolveUri(uri);
  if (!resolved || !isLoadableUri(resolved)) {
    return (
      <View style={[style, { backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
      </View>
    );
  }
  return (
    <ExpoImage
      source={{ uri: resolved }}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={200}
      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
      onLoad={onLoad}
      recyclingKey={resolved}
    />
  );
});
