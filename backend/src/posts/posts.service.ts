import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private readonly cacheService: CacheService,
  ) {}

  async create(userId: string, createPostDto: CreatePostDto) {
    const { caption, location, media } = createPostDto;

    const post = await this.prisma.post.create({
      data: {
        userId,
        caption,
        location,
        media: {
          create: media.map((m, index) => ({
            url: m.url,
            type: m.type,
            thumbnailUrl: m.thumbnailUrl,
            order: index,
          })),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        media: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    return post;
  }

  async findAll(page: number = 1, limit: number = 10, userId?: string, cursor?: string) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
    const baseQuery = {
      where: { isDeleted: false },
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        media: {
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: userId ? { where: { userId } } : false,
        savedBy: userId ? { where: { userId } } : false,
      },
    } as const;

    const posts = await this.prisma.post.findMany({
      ...baseQuery,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: (page - 1) * limitClamped }),
      take: limitClamped,
    });

    const total = cursor
      ? undefined
      : await this.prisma.post.count({
          where: { isDeleted: false },
        });

    const mapped = posts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: userId ? (post as any).likes?.length > 0 : false,
      isSaved: userId ? (post as any).savedBy?.length > 0 : false,
      likes: undefined,
      savedBy: undefined,
      _count: undefined,
    }));

    return {
      posts: mapped,
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: total != null ? Math.ceil(total / limitClamped) : undefined,
        nextCursor: mapped.length === limitClamped ? mapped[mapped.length - 1].id : undefined,
      },
    };
  }

  async findByUser(userId: string, page: number = 1, limit: number = 30, cursor?: string) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const posts = await this.prisma.post.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: (page - 1) * limitClamped }),
      take: limitClamped,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        media: {
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    });

    const total = cursor
      ? undefined
      : await this.prisma.post.count({
          where: {
            userId,
            isDeleted: false,
          },
        });

    const mapped = posts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: false,
      isSaved: false,
      likes: undefined,
      _count: undefined,
    }));

    return {
      posts: mapped,
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: total != null ? Math.ceil(total / limitClamped) : undefined,
        nextCursor: mapped.length === limitClamped ? mapped[mapped.length - 1].id : undefined,
      },
    };
  }

  async findOne(id: string, userId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
        media: {
          orderBy: {
            order: 'asc',
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
        likes: userId ? { where: { userId } } : false,
        savedBy: userId ? { where: { userId } } : false,
      },
    });

    if (!post || post.isDeleted) {
      throw new NotFoundException('Post not found');
    }

    return {
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: userId ? (post as any).likes?.length > 0 : false,
      isSaved: userId ? (post as any).savedBy?.length > 0 : false,
      likes: undefined,
      savedBy: undefined,
      _count: undefined,
    };
  }

  async delete(id: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });
  }

  async like(postId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existingLike = await tx.like.findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      });

      if (existingLike) {
        await tx.like.delete({
          where: {
            id: existingLike.id,
          },
        });
        return { liked: false };
      }

      await tx.like.create({
        data: {
          userId,
          postId,
        },
      });

      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { userId: true },
      });
      if (post) {
        await this.notificationsService.create(
          {
            userId: post.userId,
            type: 'like',
            actorId: userId,
            postId,
          },
          tx,
        );
      }

      return { liked: true };
    });
  }

  async save(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post || post.isDeleted) {
      throw new NotFoundException('Post not found');
    }
    await this.prisma.savedPost.upsert({
      where: {
        userId_postId: { userId, postId },
      },
      create: { userId, postId },
      update: {},
    });
    return { saved: true };
  }

  async unsave(postId: string, userId: string) {
    await this.prisma.savedPost.deleteMany({
      where: { userId, postId },
    });
    return { saved: false };
  }

  async findFeed(viewerId: string, page: number = 1, limit: number = 10, cursor?: string) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    const cacheKey = `feed:${viewerId}:${cursor ?? `page:${page}`}:${limitClamped}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const following = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);
    if (!followingIds.includes(viewerId)) {
      followingIds.push(viewerId);
    }
    if (followingIds.length === 0) {
      const empty = {
        posts: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
      await this.cacheService.set(cacheKey, empty, 5);
      return empty;
    }
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];
    const posts = await this.prisma.post.findMany({
      where: {
        userId: { in: followingIds },
        isDeleted: false,
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: (page - 1) * limitClamped }),
      take: limitClamped,
      orderBy,
      include: {
        user: {
          select: { id: true, username: true, avatarUrl: true },
        },
        media: { orderBy: { order: 'asc' } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId: viewerId } },
        savedBy: { where: { userId: viewerId } },
      },
    });
    const total = cursor
      ? undefined
      : await this.prisma.post.count({
          where: {
            userId: { in: followingIds },
            isDeleted: false,
          },
        });
    let mapped = posts.map((post) => ({
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: ((post as any).likes?.length ?? 0) > 0,
      isSaved: ((post as any).savedBy?.length ?? 0) > 0,
      likes: undefined,
      savedBy: undefined,
      _count: undefined,
    }));

    // Если лента пустая на первой странице — подставляем «ленту открытий» (последние посты всех пользователей)
    if (mapped.length === 0 && page === 1 && !cursor) {
      const discovery = await this.prisma.post.findMany({
        where: { isDeleted: false },
        take: Math.min(limitClamped, 20),
        orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          media: { orderBy: { order: 'asc' } },
          _count: { select: { likes: true, comments: true } },
          likes: { where: { userId: viewerId } },
          savedBy: { where: { userId: viewerId } },
        },
      });
      mapped = discovery.map((post) => ({
        ...post,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        isLiked: ((post as any).likes?.length ?? 0) > 0,
        isSaved: ((post as any).savedBy?.length ?? 0) > 0,
        likes: undefined,
        savedBy: undefined,
        _count: undefined,
      }));
    }

    const isDiscovery = page === 1 && !cursor && posts.length === 0 && mapped.length > 0;
    const response = {
      posts: mapped,
      pagination: {
        page,
        limit: limitClamped,
        total: isDiscovery ? mapped.length : total,
        totalPages: isDiscovery ? 1 : (total != null ? Math.ceil(total / limitClamped) : undefined),
        nextCursor: mapped.length === limitClamped ? mapped[mapped.length - 1].id : undefined,
      },
    };
    await this.cacheService.set(cacheKey, response, 5);
    return response;
  }

  async getSavedPosts(userId: string, page: number = 1, limit: number = 20, cursor?: string) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);

    const saved = await this.prisma.savedPost.findMany({
      where: { userId },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: (page - 1) * limitClamped }),
      take: limitClamped,
      include: {
        post: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
            media: { orderBy: { order: 'asc' } },
            _count: { select: { likes: true, comments: true } },
            likes: { where: { userId } },
            savedBy: { where: { userId } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const posts = saved
      .map((s) => s.post)
      .filter((p): p is NonNullable<typeof p> => p != null && !p.isDeleted)
      .map((post: any) => ({
        ...post,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        isLiked: ((post as any).likes?.length ?? 0) > 0,
        isSaved: true,
        likes: undefined,
        savedBy: undefined,
        _count: undefined,
      }));

    const total = cursor ? undefined : await this.prisma.savedPost.count({ where: { userId } });

    return {
      posts,
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: total != null ? Math.ceil(total / limitClamped) : undefined,
        nextCursor: saved.length === limitClamped ? saved[saved.length - 1].id : undefined,
      },
    };
  }
}
