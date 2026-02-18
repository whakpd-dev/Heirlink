/**
 * Общие типы для всех частей приложения
 */

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  user: User;
  caption?: string;
  location?: string;
  media: Media[];
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved?: boolean;
  createdAt: string;
}

export interface Media {
  id: string;
  url: string;
  type: 'photo' | 'video';
  thumbnailUrl?: string;
  order: number;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user: User;
  text: string;
  parentId?: string;
  replies?: Comment[];
  createdAt: string;
}

export interface Story {
  id: string;
  userId: string;
  user: User;
  mediaUrl: string;
  type: 'photo' | 'video';
  expiresAt: string;
  createdAt: string;
}

export interface SmartAlbumItem {
  id: string;
  userId: string;
  originalMediaId: string;
  animatedVersionId?: string;
  restoredVersionId?: string;
  aiAnalysis?: AiAnalysis;
  lifeMomentTags?: string[];
  locationData?: LocationData;
  createdAt: string;
}

export interface AiAnalysis {
  eventType?: string;
  emotions?: string[];
  estimatedDate?: string;
  location?: string;
  weather?: string;
  peopleCount?: number;
  metadata?: Record<string, any>;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  userId: string;
  user: User;
  postId?: string;
  commentId?: string;
  createdAt: string;
  isRead: boolean;
}
