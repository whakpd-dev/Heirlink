import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CacheService } from '../cache/cache.service';

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
} as const;

const LIST_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Профиль текущего пользователя (id, email, username, avatarUrl, bio).
   */
  async getMeProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Публичный профиль пользователя по id. Без email.
   * Если передан viewerId — добавляем isFollowing и isViewer.
   */
  async getById(userId: string, viewerId?: string) {
    const id = typeof userId === 'string' ? userId.trim() : '';
    if (!id) {
      throw new BadRequestException('Invalid user id');
    }
    const cacheKey = `user:profile:${id}:viewer:${viewerId ?? 'anon'}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...PUBLIC_USER_SELECT,
        _count: {
          select: {
            posts: { where: { isDeleted: false } },
            followers: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { _count, ...rest } = user;
    const profile = {
      ...rest,
      postsCount: _count.posts,
      followersCount: _count.followers,
      followingCount: _count.following,
    };

    if (viewerId) {
      const follow = await this.prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: viewerId, followingId: id },
        },
      });
      const result = {
        ...profile,
        isFollowing: !!follow,
        isViewer: viewerId === id,
      };
      await this.cacheService.set(cacheKey, result, 20);
      return result;
    }

    await this.cacheService.set(cacheKey, profile, 20);
    return profile;
  }

  /**
   * Обновление своего профиля (avatarUrl, bio).
   */
  async updateMe(userId: string, dto: UpdateProfileDto) {
    const data: { avatarUrl?: string; bio?: string } = {};
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.bio !== undefined) data.bio = dto.bio;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    });

    await this.cacheService.del(`user:profile:${userId}:viewer:anon`);
    await this.cacheService.del(`user:profile:${userId}:viewer:${userId}`);

    return user;
  }

  /**
   * Подписаться на пользователя. Идемпотентно: уже подписан — 200.
   */
  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: followingId },
      });
      if (!target) {
        throw new NotFoundException('User not found');
      }

      await tx.follow.upsert({
        where: {
          followerId_followingId: { followerId, followingId },
        },
        create: { followerId, followingId },
        update: {},
      });

      await this.notificationsService.create(
        {
          userId: followingId,
          type: 'follow',
          actorId: followerId,
        },
        tx,
      );

      await this.cacheService.del(`user:profile:${followingId}:viewer:${followerId}`);
      await this.cacheService.del(`user:profile:${followingId}:viewer:anon`);

      return { following: true };
    });
  }

  /**
   * Отписаться от пользователя. Идемпотентно.
   */
  async unfollow(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    await this.cacheService.del(`user:profile:${followingId}:viewer:${followerId}`);
    await this.cacheService.del(`user:profile:${followingId}:viewer:anon`);
    return { following: false };
  }

  /**
   * Список подписчиков пользователя (пагинация).
   */
  async getFollowers(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        select: {
          follower: { select: LIST_USER_SELECT },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);

    return {
      items: items.map((f) => f.follower),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Список подписок пользователя (пагинация).
   */
  async getFollowing(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        select: {
          following: { select: LIST_USER_SELECT },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);

    return {
      items: items.map((f) => f.following),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Предложения "подписаться": пользователи, на которых подписаны ваши подписки, но не вы.
   * Исключаем себя и уже подписанных. При отсутствии данных — топ по количеству подписчиков.
   */
  async getSuggestions(userId: string, limit: number = 10) {
    const limitClamped = Math.min(Math.max(limit, 1), 50);

    const myFollowing = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const myFollowingIds = new Set(myFollowing.map((f) => f.followingId));
    myFollowingIds.add(userId);

    if (myFollowingIds.size <= 1) {
      return this.getSuggestionsFallback(userId, limitClamped);
    }

    const suggestedByFollow = await this.prisma.follow.findMany({
      where: {
        followerId: { in: Array.from(myFollowingIds) },
        followingId: { notIn: Array.from(myFollowingIds) },
      },
      select: { followingId: true },
    });

    const countByUser = new Map<string, number>();
    for (const f of suggestedByFollow) {
      countByUser.set(f.followingId, (countByUser.get(f.followingId) ?? 0) + 1);
    }
    const sorted = Array.from(countByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitClamped)
      .map(([id]) => id);

    if (sorted.length === 0) {
      return this.getSuggestionsFallback(userId, limitClamped);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: sorted } },
      select: {
        ...LIST_USER_SELECT,
        _count: { select: { followers: true } },
      },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    const items = sorted
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        followersCount: u._count?.followers ?? 0,
      }));

    return { items };
  }

  private async getSuggestionsFallback(userId: string, limit: number) {
    const users = await this.prisma.user.findMany({
      where: { id: { not: userId } },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        _count: { select: { followers: true } },
      },
      orderBy: { followers: { _count: 'desc' } },
      take: limit,
    });
    return {
      items: users.map((u) => ({
        id: u.id,
        username: u.username,
        avatarUrl: u.avatarUrl,
        followersCount: u._count.followers,
      })),
    };
  }

  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new BadRequestException('Нельзя заблокировать себя');
    const existing = await this.prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
    if (existing) return { blocked: true };
    await this.prisma.block.create({ data: { blockerId, blockedId } });
    // Also unfollow in both directions
    await this.prisma.follow.deleteMany({
      where: { OR: [{ followerId: blockerId, followingId: blockedId }, { followerId: blockedId, followingId: blockerId }] },
    });
    return { blocked: true };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false };
  }

  async getBlockedUsers(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return blocks.map((b) => b.blocked);
  }

  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: { OR: [{ blockerId: userId1, blockedId: userId2 }, { blockerId: userId2, blockedId: userId1 }] },
    });
    return !!block;
  }
}
