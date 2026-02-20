import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { store } from './src/store/store';
import { ThemeProvider } from './src/context/ThemeContext';
import { ToastProvider } from './src/context/ToastContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { queryClient } from './src/queryClient';
import { processUploadQueue } from './src/services/uploadQueue';
import * as Sentry from '@sentry/react-native';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { apiService } from './src/services/api';
import { socketService } from './src/services/socketService';
import { useToast } from './src/context/ToastContext';

const ApiErrorNotifier: React.FC = () => {
  const { showToast } = useToast();
  useEffect(() => {
    apiService.setOnError((message) => showToast(message, 'error'));
  }, [showToast]);
  return null;
};

export default function App() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(Boolean(state.isConnected));
      if (state.isConnected) {
        processUploadQueue();
        socketService.connect();
      } else {
        socketService.disconnect();
      }
    });
    socketService.connect();
    const t = setTimeout(() => {
      try {
        const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
        if (dsn) {
          Sentry.init({ dsn, enableInExpoDevelopment: false });
        }
      } catch (_e) {
        // Sentry init failed — не падаем при старте
      }
    }, 500);
    return () => {
      clearTimeout(t);
      unsubscribe();
      socketService.disconnect();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <ApiErrorNotifier />
              <ErrorBoundary>
                <AppNavigator />
              </ErrorBoundary>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
