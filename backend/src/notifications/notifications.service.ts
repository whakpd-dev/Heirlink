import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';

export type NotificationType = 'like' | 'comment' | 'follow' | 'comment_reply';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  actorId: string;
  postId?: string;
  commentId?: string;
}

const ACTOR_SELECT = { id: true, username: true, avatarUrl: true } as const;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Создать уведомление. Не создаёт, если userId === actorId (не уведомлять себя).
   */
  async create(dto: CreateNotificationDto, tx?: Prisma.TransactionClient) {
    if (dto.userId === dto.actorId) return null;
    if (!tx && this.queueService.isEnabled()) {
      await this.queueService.enqueueNotification(dto);
      return { queued: true };
    }
    const client = tx ?? this.prisma;
    const n = await client.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        actorId: dto.actorId,
        postId: dto.postId ?? undefined,
        commentId: dto.commentId ?? undefined,
      },
    });
    return n;
  }

  async findAll(userId: string, page: number = 1, limit: number = 20, cursor?: string) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        include: {
          actor: { select: ACTOR_SELECT },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: (page - 1) * limitClamped }),
        take: limitClamped,
      }),
      cursor ? Promise.resolve(undefined) : this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        actor: n.actor,
        postId: n.postId,
        commentId: n.commentId,
        read: n.read,
        createdAt: n.createdAt,
      })),
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: total != null ? Math.ceil(total / limitClamped) : undefined,
        nextCursor: items.length === limitClamped ? items[items.length - 1].id : undefined,
      },
    };
  }

  async markRead(id: string, userId: string) {
    const n = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!n) throw new NotFoundException('Notification not found');
    if (n.userId !== userId) throw new ForbiddenException('Not your notification');
    await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return { read: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { read: true };
  }
}
