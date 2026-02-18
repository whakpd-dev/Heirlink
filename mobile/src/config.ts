/**
 * Конфигурация приложения
 * Для Expo используем Constants или переменные окружения
 */

import Constants from 'expo-constants';

// Хост Metro (откуда грузится бандл) = тот же компьютер, где бэкенд
const getDevServerHost = (): string | null => {
  const hostUri =
    Constants.expoConfig?.expoClient?.hostUri ??
    (Constants as any).manifest?.hostUri ??
    (Constants as any).manifest?.debuggerHost;
  if (hostUri && typeof hostUri === 'string') {
    return hostUri.split(':')[0] ?? null;
  }
  return null;
};

// Продакшен сервер (HTTPS)
const PRODUCTION_API_URL = 'https://api.whakcomp.ru';

const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  if (__DEV__) {
    const host = getDevServerHost();
    if (host) return `http://${host}:3000`;
  }
  return PRODUCTION_API_URL;
};

export const API_URL = getApiUrl();
export const API_BASE_URL = `${API_URL}/api`;
export const WS_URL = API_URL.replace(/^http/, 'ws');

if (__DEV__) {
  console.log('[HeirLink] API_BASE_URL:', API_BASE_URL);
}
