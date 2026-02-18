import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const USER_SELECT = { id: true, username: true, avatarUrl: true } as const;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Список диалогов (последнее сообщение с каждым пользователем)
   */
  async getConversations(userId: string, page: number = 1, limit: number = 50) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * limitClamped;

    const sent = await this.prisma.message.findMany({
      where: { senderId: userId },
      distinct: ['recipientId'],
      orderBy: { createdAt: 'desc' },
      include: {
        recipient: { select: USER_SELECT },
      },
    });

    const received = await this.prisma.message.findMany({
      where: { recipientId: userId },
      distinct: ['senderId'],
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: USER_SELECT },
      },
    });

    const byOtherId = new Map<
      string,
      { other: { id: string; username: string; avatarUrl: string | null }; lastMessage: string; lastAt: Date }
    >();

    for (const m of sent) {
      const existing = byOtherId.get(m.recipientId);
      if (!existing || m.createdAt > existing.lastAt) {
        byOtherId.set(m.recipientId, {
          other: m.recipient,
          lastMessage: m.text,
          lastAt: m.createdAt,
        });
      }
    }
    for (const m of received) {
      const existing = byOtherId.get(m.senderId);
      if (!existing || m.createdAt > existing.lastAt) {
        byOtherId.set(m.senderId, {
          other: m.sender,
          lastMessage: m.text,
          lastAt: m.createdAt,
        });
      }
    }

    const list = Array.from(byOtherId.entries())
      .map(([otherId, v]) => ({
        otherUser: v.other,
        lastMessage: v.lastMessage,
        lastAt: v.lastAt,
      }))
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

    const total = list.length;
    const items = list.slice(skip, skip + limitClamped);

    return {
      items,
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: Math.ceil(total / limitClamped),
      },
    };
  }

  /**
   * Сообщения с конкретным пользователем (диалог)
   */
  async getMessagesWith(
    userId: string,
    otherUserId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * limitClamped;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, recipientId: otherUserId },
            { senderId: otherUserId, recipientId: userId },
          ],
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limitClamped,
        include: {
          sender: { select: USER_SELECT },
          recipient: { select: USER_SELECT },
        },
      }),
      this.prisma.message.count({
        where: {
          OR: [
            { senderId: userId, recipientId: otherUserId },
            { senderId: otherUserId, recipientId: userId },
          ],
        },
      }),
    ]);

    return {
      items: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        recipientId: m.recipientId,
        text: m.text,
        createdAt: m.createdAt,
        sender: m.sender,
        isFromMe: m.senderId === userId,
      })),
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: Math.ceil(total / limitClamped),
      },
    };
  }

  /**
   * Отправить сообщение
   */
  async send(userId: string, recipientId: string, text: string) {
    if (userId === recipientId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true },
    });
    if (!recipient) {
      throw new BadRequestException('User not found');
    }

    const message = await this.prisma.message.create({
      data: { senderId: userId, recipientId, text },
      include: {
        sender: { select: USER_SELECT },
        recipient: { select: USER_SELECT },
      },
    });

    return {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      text: message.text,
      createdAt: message.createdAt,
      sender: message.sender,
      isFromMe: true,
    };
  }
}
