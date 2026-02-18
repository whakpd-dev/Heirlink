import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

const USER_LIST_SELECT = { id: true, username: true, avatarUrl: true } as const;
const MAX_QUERY_LENGTH = 100;

/**
 * Санитизация поискового запроса: trim, ограничение длины.
 * Prisma contains/mode: 'insensitive' безопасен от инъекций.
 */
function sanitizeQuery(q: string | undefined): string {
  if (q == null || typeof q !== 'string') return '';
  return q.trim().slice(0, MAX_QUERY_LENGTH);
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async searchUsers(
    q: string,
    page: number = 1,
    limit: number = 20,
    viewerId?: string,
  ) {
    const query = sanitizeQuery(q);
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * limitClamped;

    if (!query) {
      return {
        items: [],
        pagination: { page, limit: limitClamped, total: 0, totalPages: 0 },
      };
    }

    const where = {
      username: { contains: query, mode: 'insensitive' as const },
    };

    const cacheKey = `search:users:${query}:${page}:${limitClamped}:${viewerId ?? 'anon'}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...USER_LIST_SELECT,
          _count: { select: { following: true } },
          ...(viewerId
            ? {
                following: {
                  where: { followerId: viewerId },
                  select: { id: true },
                },
              }
            : {}),
        },
        orderBy: { username: 'asc' },
        skip,
        take: limitClamped,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((u: any) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      followersCount: u._count?.following ?? 0,
      isFollowing: viewerId && (u.following?.length ?? 0) > 0,
    }));

    const response = {
      items,
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: Math.ceil(total / limitClamped),
      },
    };
    await this.cacheService.set(cacheKey, response, 30);
    return response;
  }

  async searchPosts(q: string, page: number = 1, limit: number = 20) {
    const query = sanitizeQuery(q);
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * limitClamped;

    if (!query) {
      return {
        posts: [],
        pagination: { page, limit: limitClamped, total: 0, totalPages: 0 },
      };
    }

    const where = {
      isDeleted: false,
      OR: [{ caption: { contains: query, mode: 'insensitive' as const } }],
    };

    const cacheKey = `search:posts:${query}:${page}:${limitClamped}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          user: { select: USER_LIST_SELECT },
          media: { orderBy: { order: 'asc' } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitClamped,
      }),
      this.prisma.post.count({ where }),
    ]);

    const result = posts.map((p) => ({
      ...p,
      likesCount: p._count.likes,
      commentsCount: p._count.comments,
      _count: undefined,
    }));

    const response = {
      posts: result,
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: Math.ceil(total / limitClamped),
      },
    };
    await this.cacheService.set(cacheKey, response, 30);
    return response;
  }
}
