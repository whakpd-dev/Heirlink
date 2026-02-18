import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiService } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
};

// Async thunks
const USER_STORAGE_KEY = 'heirlink_user';

export const register = createAsyncThunk(
  'auth/register',
  async (
    { email, username, password }: { email: string; username: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await apiService.register(email, username, password);
      await AsyncStorage.setItem('accessToken', response.accessToken);
      await AsyncStorage.setItem('refreshToken', response.refreshToken);
      if (response.user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      return response;
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Ошибка регистрации';
      return rejectWithValue(msg);
    }
  },
);

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }) => {
    const response = await apiService.login(email, password);
    await AsyncStorage.setItem('accessToken', response.accessToken);
    await AsyncStorage.setItem('refreshToken', response.refreshToken);
    if (response.user) {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
    }
    return response;
  },
);

export const checkAuth = createAsyncThunk('auth/checkAuth', async () => {
  const accessToken = await AsyncStorage.getItem('accessToken');
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!accessToken || !refreshToken) {
    return { accessToken: null, refreshToken: null, user: null };
  }
  const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
  const storedUser = stored ? (JSON.parse(stored) as User) : null;
  if (storedUser) {
    return { accessToken, refreshToken, user: storedUser };
  }
  try {
    const user = await apiService.getMe();
    if (user) await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    return { accessToken, refreshToken, user: user ?? null };
  } catch {
    return { accessToken, refreshToken, user: null };
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken', USER_STORAGE_KEY]);
});

export const restoreUserFromStorage = createAsyncThunk(
  'auth/restoreUserFromStorage',
  async (): Promise<{ user: User | null }> => {
    const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
    const user = stored ? (JSON.parse(stored) as User) : null;
    return { user };
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Register
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || action.error.message || 'Ошибка регистрации';
      });

    // Login
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
      });

    // Check Auth
    builder
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.accessToken && action.payload.refreshToken) {
          state.accessToken = action.payload.accessToken;
          state.refreshToken = action.payload.refreshToken;
          state.user = action.payload.user ?? null;
          state.isAuthenticated = true;
        } else {
          state.user = null;
          state.accessToken = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
        }
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
      });

    // Logout
    builder
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      });

    // Restore user from storage (e.g. when opening profile and user was null)
    builder.addCase(restoreUserFromStorage.fulfilled, (state, action) => {
      if (action.payload.user) {
        state.user = action.payload.user;
      }
    });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
