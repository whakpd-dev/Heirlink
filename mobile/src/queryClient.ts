import { QueryClient } from '@tanstack/react-query';
import { setQueryClientForLogout } from './store/authSlice';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

setQueryClientForLogout(queryClient);
