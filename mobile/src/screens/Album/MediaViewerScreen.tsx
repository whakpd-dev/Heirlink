import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Alert,
  Platform,
  ActionSheetIOS,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../../context/ThemeContext';
import { apiService } from '../../services/api';
import { SmartImage } from '../../components/SmartImage';
import { VideoPlayer } from '../../components/VideoPlayer';
import { RootState } from '../../store/store';
import { API_URL } from '../../config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function resolveUri(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('http')) {
    return uri.includes('localhost:3000')
      ? uri.replace(/http:\/\/localhost:3000/g, 'https://api.whakcomp.ru')
      : uri;
  }
  const base = (API_URL || '').replace(/\/$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/${uri}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const MediaViewerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const authUser = useSelector((state: RootState) => state.auth.user);

  const items: any[] = route.params?.items ?? [];
  const initialIndex: number = route.params?.initialIndex ?? 0;
  const albumId: string = route.params?.albumId ?? '';
  const isAlbumOwner: boolean = route.params?.isAlbumOwner ?? false;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const currentItem = items[currentIndex];
  const isOwnItem = currentItem?.addedBy?.id === authUser?.id || currentItem?.addedById === authUser?.id;
  const canDelete = isOwnItem || isAlbumOwner;

  const handleDownload = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Доступ', 'Нужен доступ к галерее для сохранения');
        return;
      }
      const url = resolveUri(currentItem?.media?.url ?? '');
      if (!url) return;
      const isVideo = currentItem?.media?.type === 'video';
      const ext = isVideo ? '.mp4' : '.jpg';
      const localUri = FileSystem.documentDirectory + `heirlink_${Date.now()}${ext}`;
      const download = await FileSystem.downloadAsync(url, localUri);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      Alert.alert('Сохранено', isVideo ? 'Видео сохранено в галерею' : 'Фото сохранено в галерею');
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить файл');
    }
  }, [currentItem]);

  const handleDelete = useCallback(async () => {
    if (!albumId || !currentItem?.id) return;
    Alert.alert('Удалить', 'Удалить этот элемент из альбома?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.removeAlbumItem(albumId, currentItem.id);
            queryClient.invalidateQueries({ queryKey: ['albumItems', albumId] });
            if (items.length <= 1) {
              navigation.goBack();
            } else {
              setCurrentIndex((i) => Math.min(i, items.length - 2));
            }
          } catch {
            Alert.alert('Ошибка', 'Не удалось удалить');
          }
        },
      },
    ]);
  }, [albumId, currentItem?.id, items.length, queryClient, navigation]);

  const handleReport = useCallback(() => {
    Alert.prompt ? Alert.prompt(
      'Пожаловаться',
      'Укажите причину',
      async (reason) => {
        if (!reason?.trim()) return;
        try {
          await apiService.createReport('album_item', currentItem?.id, reason.trim());
          Alert.alert('Спасибо', 'Жалоба отправлена');
        } catch {
          Alert.alert('Ошибка', 'Не удалось отправить жалобу');
        }
      },
    ) : Alert.alert('Пожаловаться', 'Функция доступна на iOS');
  }, [currentItem?.id]);

  const handleActions = useCallback(() => {
    const options: string[] = ['Скачать в галерею'];
    if (canDelete) options.push('Удалить');
    if (!isOwnItem) options.push('Пожаловаться');
    options.push('Отмена');

    const cancelIndex = options.length - 1;
    const destructiveIndex = options.indexOf('Удалить');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
        (idx) => {
          if (options[idx] === 'Скачать в галерею') handleDownload();
          if (options[idx] === 'Удалить') handleDelete();
          if (options[idx] === 'Пожаловаться') handleReport();
        },
      );
    } else {
      const buttons = options.slice(0, -1).map((text) => ({
        text,
        style: (text === 'Удалить' ? 'destructive' : 'default') as any,
        onPress: () => {
          if (text === 'Скачать в галерею') handleDownload();
          if (text === 'Удалить') handleDelete();
          if (text === 'Пожаловаться') handleReport();
        },
      }));
      buttons.push({ text: 'Отмена', style: 'cancel', onPress: () => {} });
      Alert.alert('Действия', undefined, buttons);
    }
  }, [canDelete, isOwnItem, handleDownload, handleDelete, handleReport]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const renderItem = useCallback(({ item }: { item: any }) => {
    const isVideo = item.media?.type === 'video';
    const url = item.media?.url ?? '';
    return (
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000', justifyContent: 'center' }}>
        {isVideo ? (
          <VideoPlayer uri={url} style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }} autoPlay={false} muted={false} />
        ) : (
          <SmartImage uri={url} style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }} contentFit="contain" />
        )}
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item: any) => item.id}
        renderItem={renderItem}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerUser} numberOfLines={1}>
            {currentItem?.addedBy?.username ?? ''}
          </Text>
          <Text style={styles.headerDate}>{formatDate(currentItem?.createdAt)}</Text>
        </View>
        <TouchableOpacity onPress={handleActions} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity onPress={handleDownload} style={styles.bottomBtn}>
          <Ionicons name="download-outline" size={24} color="#FFF" />
          <Text style={styles.bottomLabel}>Скачать</Text>
        </TouchableOpacity>
        {canDelete && (
          <TouchableOpacity onPress={handleDelete} style={styles.bottomBtn}>
            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            <Text style={[styles.bottomLabel, { color: '#FF3B30' }]}>Удалить</Text>
          </TouchableOpacity>
        )}
        {!isOwnItem && (
          <TouchableOpacity onPress={handleReport} style={styles.bottomBtn}>
            <Ionicons name="flag-outline" size={24} color="#FFF" />
            <Text style={styles.bottomLabel}>Жалоба</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.counter}>{currentIndex + 1} / {items.length}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerBtn: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerUser: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 24,
    zIndex: 10,
  },
  bottomBtn: {
    alignItems: 'center',
    gap: 4,
  },
  bottomLabel: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '500',
  },
  counter: {
    marginLeft: 'auto',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
});
