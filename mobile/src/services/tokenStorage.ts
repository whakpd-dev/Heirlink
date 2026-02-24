import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) return AsyncStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) return AsyncStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return getItem('accessToken');
  },
  async setAccessToken(token: string): Promise<void> {
    return setItem('accessToken', token);
  },
  async getRefreshToken(): Promise<string | null> {
    return getItem('refreshToken');
  },
  async setRefreshToken(token: string): Promise<void> {
    return setItem('refreshToken', token);
  },
  async clearTokens(): Promise<void> {
    await Promise.all([deleteItem('accessToken'), deleteItem('refreshToken')]);
  },
};
