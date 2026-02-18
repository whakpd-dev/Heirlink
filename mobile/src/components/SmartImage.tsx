import React from 'react';
import { View, ImageStyle, StyleProp } from 'react-native';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  contentFit?: ExpoImageProps['contentFit'];
};

/** Превращает относительный путь (например /api/uploads/...) в полный URL. */
function resolveUri(uri: string): string {
  if (!uri || typeof uri !== 'string') return '';
  const trimmed = uri.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = (API_URL || '').replace(/\/$/, '');
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

/** Проверяет, что URI загружаем через сеть (http/https). ph:// и file:// на iOS/Android не поддерживаются. */
function isLoadableUri(uri: string): boolean {
  if (!uri || typeof uri !== 'string') return false;
  const lower = uri.trim().toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

export const SmartImage: React.FC<Props> = ({ uri, style, contentFit = 'cover' }) => {
  const resolved = resolveUri(uri);
  if (!resolved || !isLoadableUri(resolved)) {
    return (
      <View style={[style, { backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="image-outline" size={32} color="#666" />
      </View>
    );
  }
  return <ExpoImage source={{ uri: resolved }} style={style} contentFit={contentFit} />;
};
