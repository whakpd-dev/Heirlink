import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL } from '../config';
import { tokenStorage } from './tokenStorage';

type UnauthorizedCallback = () => void;
type ErrorCallback = (message: string) => void;

class ApiService {
  private client: AxiosInstance;
  private onUnauthorized: UnauthorizedCallback | null = null;
  private onError: ErrorCallback | null = null;
  private lastErrorAt = 0;
  private lastErrorMessage = '';
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private isRefreshing = false;

  setOnUnauthorized(cb: UnauthorizedCallback) {
    this.onUnauthorized = cb;
  }

  setOnError(cb: ErrorCallback) {
    this.onError = cb;
  }

  private notifyError(message: string) {
    if (!this.onError) return;
    const now = Date.now();
    if (this.lastErrorMessage === message && now - this.lastErrorAt < 8000) return;
    this.lastErrorAt = now;
    this.lastErrorMessage = message;
    this.onError(message);
  }

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // Увеличено для медленных соединений
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor для добавления токена
    this.client.interceptors.request.use(
      async (config) => {
        const token = await tokenStorage.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Лог ошибок сети (для отладки). Не логируем ожидаемые 404 (эндпоинты могут быть не задеплоены).
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const url = (error.config?.baseURL ?? '') + (error.config?.url ?? '');
        const status = error.response?.status;
        const errMsg = error.message || '';
        const isOptional404 =
          status === 404 &&
          (url.includes('/auth/me') ||
            url.includes('/posts/user/') ||
            url.includes('/stories') ||
            url.includes('/notifications') ||
            url.includes('/posts/saved') ||
            url.includes('messages'));
        if (!isOptional404) {
          console.warn('[HeirLink] API Error:', error.message, url, error.code);
        }
        if (!status && (error.code === 'ERR_NETWORK' || errMsg.includes('Network'))) {
          this.notifyError('Нет соединения с сервером. Проверьте интернет.');
        } else if (status && status >= 500) {
          this.notifyError('Сервер временно недоступен. Попробуйте позже.');
        }
        if (status === 401) {
          // Попытка обновить токен
          const refreshToken = await tokenStorage.getRefreshToken();
          if (refreshToken) {
            try {
              const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken,
              });
              const { accessToken, refreshToken: newRefreshToken } = response.data;
              await tokenStorage.setAccessToken(accessToken);
              await tokenStorage.setRefreshToken(newRefreshToken);
              
              if (error.config) {
                error.config.headers.Authorization = `Bearer ${accessToken}`;
                return this.client.request(error.config);
              }
            } catch (refreshError) {
              await tokenStorage.clearTokens();
              this.onUnauthorized?.();
              return Promise.reject(refreshError);
            }
          }
        }
        return Promise.reject(error);
      },
    );
  }

  scheduleProactiveRefresh(expiresInMs: number) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const refreshAt = Math.max(expiresInMs - 5 * 60 * 1000, 30_000);
    this.refreshTimer = setTimeout(() => this.doProactiveRefresh(), refreshAt);
  }

  private async doProactiveRefresh() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    try {
      const rt = await tokenStorage.getRefreshToken();
      if (!rt) return;
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken: rt });
      const { accessToken, refreshToken: newRT } = response.data;
      await tokenStorage.setAccessToken(accessToken);
      await tokenStorage.setRefreshToken(newRT);
      this.scheduleProactiveRefresh(6 * 24 * 60 * 60 * 1000);
    } catch {
      /* will be handled by 401 interceptor on next request */
    } finally {
      this.isRefreshing = false;
    }
  }

  stopProactiveRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Auth methods
  async register(email: string, username: string, password: string) {
    const response = await this.client.post('/auth/register', {
      email,
      username,
      password,
    });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post('/auth/refresh', {
      refreshToken,
    });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async logoutServer(refreshToken: string) {
    await this.client.post('/auth/logout', { refreshToken });
  }

  // Posts methods
  async getFeed(page: number = 1, limit: number = 10) {
    const response = await this.client.get('/posts/feed', {
      params: { page, limit },
    });
    return response.data;
  }

  async getPost(postId: string) {
    const response = await this.client.get(`/posts/${postId}`);
    return response.data;
  }

  async getPostsByUser(userId: string, page: number = 1, limit: number = 30) {
    const response = await this.client.get(`/posts/user/${userId}`, {
      params: { page, limit },
    });
    return response.data;
  }

  async likePost(postId: string) {
    const response = await this.client.post(`/posts/${postId}/like`);
    return response.data;
  }

  async savePost(postId: string) {
    const response = await this.client.post(`/posts/${postId}/save`);
    return response.data;
  }

  async unsavePost(postId: string) {
    const response = await this.client.delete(`/posts/${postId}/save`);
    return response.data;
  }

  async getSavedPosts(page: number = 1, limit: number = 20) {
    const response = await this.client.get('/posts/saved', {
      params: { page, limit },
    });
    return response.data;
  }

  /** Загрузка файла на сервер. type: posts | avatars | stories. Возвращает URL. */
  async uploadFile(
    uri: string,
    kind: 'photo' | 'video' = 'photo',
    fileName?: string,
    uploadType: 'posts' | 'avatars' | 'stories' | 'albums' = 'posts',
  ): Promise<{ url: string }> {
    const formData = new FormData();
    const mime = kind === 'video' ? 'video/mp4' : 'image/jpeg';
    const name = fileName ?? (kind === 'video' ? 'video.mp4' : 'photo.jpg');
    formData.append('file', {
      uri,
      type: mime,
      name,
    } as unknown as Blob);
    const response = await this.client.post<{ url: string }>(`/upload?type=${uploadType}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: [
        (data, headers) => {
          delete headers['Content-Type'];
          return data;
        },
      ],
    });
    return response.data;
  }

  async createPost(data: {
    caption?: string;
    location?: string;
    media: { url: string; type: 'photo' | 'video'; thumbnailUrl?: string }[];
  }) {
    const response = await this.client.post('/posts', data);
    return response.data;
  }

  // Comments methods
  async getComments(postId: string, page: number = 1, limit: number = 20) {
    const response = await this.client.get(`/posts/${postId}/comments`, {
      params: { page, limit },
    });
    return response.data;
  }

  async createComment(postId: string, text: string, parentId?: string) {
    const response = await this.client.post(`/posts/${postId}/comments`, {
      text,
      parentId: parentId || undefined,
    });
    return response.data;
  }

  async updateComment(commentId: string, text: string) {
    const response = await this.client.patch(`/comments/${commentId}`, {
      text,
    });
    return response.data;
  }

  async deleteComment(commentId: string) {
    await this.client.delete(`/comments/${commentId}`);
  }

  // Users methods
  async getUserProfile(userId: string) {
    const id = typeof userId === 'string' ? userId.trim() : String(userId ?? '').trim();
    if (!id) throw new Error('User id is required');
    const url = `/users/${encodeURIComponent(id)}`;
    if (__DEV__) {
      console.log('[HeirLink API getUserProfile] request', { userId: id, url, baseURL: this.client.defaults.baseURL });
    }
    try {
      const response = await this.client.get(url);
      if (__DEV__) {
        console.log('[HeirLink API getUserProfile] response', { status: response.status, username: response.data?.username });
      }
      return response.data;
    } catch (err: any) {
      if (__DEV__) {
        console.warn('[HeirLink API getUserProfile] failed', {
          userId: id,
          status: err?.response?.status,
          data: err?.response?.data,
          message: err?.message,
        });
      }
      throw err;
    }
  }

  async updateProfile(data: { avatarUrl?: string; bio?: string }) {
    const response = await this.client.patch('/users/me', data);
    return response.data;
  }

  async followUser(userId: string) {
    const response = await this.client.post(`/users/${userId}/follow`);
    return response.data;
  }

  async unfollowUser(userId: string) {
    const response = await this.client.delete(`/users/${userId}/follow`);
    return response.data;
  }

  async getFollowers(userId: string, page: number = 1, limit: number = 20) {
    const response = await this.client.get(`/users/${userId}/followers`, {
      params: { page, limit },
    });
    return response.data;
  }

  async getFollowing(userId: string, page: number = 1, limit: number = 20) {
    const response = await this.client.get(`/users/${userId}/following`, {
      params: { page, limit },
    });
    return response.data;
  }

  // Notifications
  async getNotifications(page: number = 1, limit: number = 20) {
    const response = await this.client.get('/notifications', {
      params: { page, limit },
    });
    return response.data;
  }

  async markNotificationRead(notificationId: string) {
    const response = await this.client.patch(
      `/notifications/${notificationId}/read`,
    );
    return response.data;
  }

  async markAllNotificationsRead() {
    const response = await this.client.post('/notifications/read-all');
    return response.data;
  }

  // Search
  async searchUsers(q: string, page: number = 1, limit: number = 20) {
    const response = await this.client.get('/search/users', {
      params: { q, page, limit },
    });
    return response.data;
  }

  async searchPosts(q: string, page: number = 1, limit: number = 20) {
    const response = await this.client.get('/search/posts', {
      params: { q, page, limit },
    });
    return response.data;
  }

  async getSuggestions(limit: number = 10) {
    const response = await this.client.get('/users/suggestions', {
      params: { limit },
    });
    return response.data;
  }

  // Smart Album (AI)
  async smartAlbumUpload(mediaUrl: string, type?: string) {
    const response = await this.client.post('/smart-album/upload', {
      mediaUrl,
      type: type || undefined,
    });
    return response.data;
  }

  async getSmartAlbumJob(jobId: string) {
    const response = await this.client.get(`/smart-album/jobs/${jobId}`);
    return response.data;
  }

  async getSmartAlbumItems(page: number = 1, limit: number = 20) {
    const response = await this.client.get('/smart-album/items', {
      params: { page, limit },
    });
    return response.data;
  }

  async getSmartAlbumItem(itemId: string) {
    const response = await this.client.get(`/smart-album/items/${itemId}`);
    return response.data;
  }

  async getHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Stories
  async getStoriesFeed() {
    const response = await this.client.get('/stories');
    return response.data;
  }

  async getMyStories() {
    const response = await this.client.get('/stories/me');
    return response.data;
  }

  async createStory(mediaUrl: string, type: 'photo' | 'video') {
    const response = await this.client.post('/stories', { mediaUrl, type });
    return response.data;
  }

  async deleteStory(storyId: string) {
    await this.client.delete(`/stories/${storyId}`);
  }

  // Messages / Chat
  async getConversations(page: number = 1, limit: number = 50) {
    const response = await this.client.get('/messages/conversations', {
      params: { page, limit },
    });
    return response.data;
  }

  async getMessagesWith(userId: string, page: number = 1, limit: number = 50) {
    const response = await this.client.get(`/messages/with/${userId}`, {
      params: { page, limit },
    });
    return response.data;
  }

  async sendMessage(recipientId: string, text: string) {
    const response = await this.client.post('/messages', {
      recipientId,
      text: text.trim(),
    });
    return response.data;
  }

  // AI (Grok / xAI)
  async postAiChat(messages: { role: 'system' | 'user' | 'assistant'; content: any }[], options?: { model?: string; temperature?: number }) {
    const response = await this.client.post<{ choices?: Array<{ message?: { role: string; content: string } }> }>('/ai/chat', {
      messages,
      model: options?.model ?? 'grok-4-latest',
      stream: false,
      temperature: options?.temperature ?? 0.7,
    });
    return response.data;
  }

  // AI Image Generation
  async postAiGenerateImage(
    prompt: string,
    options?: { image_url?: string; n?: number; aspect_ratio?: string },
  ): Promise<{ images: { url: string }[] }> {
    const response = await this.client.post('/ai/generate-image', {
      prompt,
      ...options,
    }, { timeout: 120000 }); // image gen can take a while
    return response.data;
  }

  // AI Video Generation (returns request_id — needs polling)
  async postAiGenerateVideo(
    prompt: string,
    options?: { image_url?: string; duration?: number; aspect_ratio?: string; resolution?: string },
  ): Promise<{ request_id: string }> {
    const response = await this.client.post('/ai/generate-video', {
      prompt,
      ...options,
    }, { timeout: 60000 });
    return response.data;
  }

  // Poll video generation result
  async getAiVideoResult(
    requestId: string,
  ): Promise<{ status: string; url?: string; duration?: number; error?: string }> {
    const response = await this.client.get(`/ai/video/${requestId}`);
    return response.data;
  }

  // ─── Albums ───

  async getMyAlbums() {
    const response = await this.client.get('/albums/my');
    return response.data;
  }

  async getUserAlbums(userId: string) {
    const response = await this.client.get(`/albums/user/${userId}`);
    return response.data;
  }

  async getAlbum(albumId: string) {
    const response = await this.client.get(`/albums/${albumId}`);
    return response.data;
  }

  async getAlbumItems(albumId: string, cursor?: string, limit = 20) {
    const response = await this.client.get(`/albums/${albumId}/items`, {
      params: { cursor, limit },
    });
    return response.data;
  }

  async createAlbum(name: string, visibility: 'public' | 'private' = 'private') {
    const response = await this.client.post('/albums', { name, visibility });
    return response.data;
  }

  async updateAlbum(albumId: string, data: { name?: string; visibility?: string; coverUrl?: string }) {
    const response = await this.client.patch(`/albums/${albumId}`, data);
    return response.data;
  }

  async deleteAlbum(albumId: string) {
    await this.client.delete(`/albums/${albumId}`);
  }

  async addAlbumItem(albumId: string, uri: string, kind: 'photo' | 'video' = 'photo', caption?: string) {
    const formData = new FormData();
    const mime = kind === 'video' ? 'video/mp4' : 'image/jpeg';
    const name = kind === 'video' ? 'video.mp4' : 'photo.jpg';
    formData.append('file', { uri, type: mime, name } as unknown as Blob);
    if (caption) formData.append('caption', caption);
    const response = await this.client.post(`/albums/${albumId}/items`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      transformRequest: [(data, headers) => { delete headers['Content-Type']; return data; }],
    });
    return response.data;
  }

  async removeAlbumItem(albumId: string, itemId: string) {
    await this.client.delete(`/albums/${albumId}/items/${itemId}`);
  }

  async getAlbumMembers(albumId: string) {
    const response = await this.client.get(`/albums/${albumId}/members`);
    return response.data;
  }

  async addAlbumMember(albumId: string, userId: string, role: 'editor' | 'viewer' = 'editor') {
    const response = await this.client.post(`/albums/${albumId}/members`, { userId, role });
    return response.data;
  }

  async removeAlbumMember(albumId: string, userId: string) {
    await this.client.delete(`/albums/${albumId}/members/${userId}`);
  }

  // ─── Posts: Edit / Delete ───

  async editPost(postId: string, data: { caption?: string }) {
    const response = await this.client.patch(`/posts/${postId}`, data);
    return response.data;
  }

  async deletePost(postId: string) {
    await this.client.delete(`/posts/${postId}`);
  }

  // ─── Reports ───

  async createReport(targetType: string, targetId: string, reason: string) {
    const response = await this.client.post('/reports', { targetType, targetId, reason });
    return response.data;
  }

  // ─── Block Users ───

  async blockUser(userId: string) {
    const response = await this.client.post(`/users/${userId}/block`);
    return response.data;
  }

  async unblockUser(userId: string) {
    const response = await this.client.delete(`/users/${userId}/block`);
    return response.data;
  }

  async getBlockedUsers() {
    const response = await this.client.get('/users/me/blocked');
    return response.data;
  }

  /** Get auth headers for manual fetch (SSE streaming) */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await tokenStorage.getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  getBaseUrl(): string {
    return this.client.defaults.baseURL ?? '';
  }
}

export const apiService = new ApiService();
