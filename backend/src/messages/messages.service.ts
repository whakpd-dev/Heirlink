import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';

const USER_SELECT = { id: true, username: true, avatarUrl: true } as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
  ) {}

  /**
   * Список диалогов (последнее сообщение с каждым пользователем).
   * Uses DISTINCT ON at the DB level for efficient pagination.
   */
  async getConversations(userId: string, page: number = 1, limit: number = 50) {
    const limitClamped = Math.min(Math.max(limit, 1), 100);
    const skip = (page - 1) * limitClamped;

    const rows: Array<{
      other_id: string;
      last_text: string;
      last_at: Date;
      other_username: string;
      other_avatar: string | null;
    }> = await this.prisma.$queryRaw`
      WITH conversations AS (
        SELECT
          CASE WHEN m."senderId" = ${userId} THEN m."recipientId" ELSE m."senderId" END AS other_id,
          m.text AS last_text,
          m."createdAt" AS last_at,
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN m."senderId" = ${userId} THEN m."recipientId" ELSE m."senderId" END
            ORDER BY m."createdAt" DESC
          ) AS rn
        FROM "Message" m
        WHERE m."senderId" = ${userId} OR m."recipientId" = ${userId}
      )
      SELECT c.other_id, c.last_text, c.last_at,
             u.username AS other_username, u."avatarUrl" AS other_avatar
      FROM conversations c
      JOIN "User" u ON u.id = c.other_id
      WHERE c.rn = 1
      ORDER BY c.last_at DESC
      LIMIT ${limitClamped} OFFSET ${skip}
    `;

    const countResult: Array<{ cnt: bigint }> = await this.prisma.$queryRaw`
      SELECT COUNT(DISTINCT CASE WHEN m."senderId" = ${userId} THEN m."recipientId" ELSE m."senderId" END)::bigint AS cnt
      FROM "Message" m
      WHERE m."senderId" = ${userId} OR m."recipientId" = ${userId}
    `;
    const total = Number(countResult[0]?.cnt ?? 0);

    const items = rows.map((r) => ({
      otherUser: { id: r.other_id, username: r.other_username, avatarUrl: r.other_avatar },
      lastMessage: r.last_text,
      lastAt: r.last_at,
    }));

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

    const result = {
      id: message.id,
      senderId: message.senderId,
      recipientId: message.recipientId,
      text: message.text,
      createdAt: message.createdAt,
      sender: message.sender,
      isFromMe: true,
    };

    this.gateway.emitToUser(recipientId, 'newMessage', {
      ...result,
      isFromMe: false,
    });

    return result;
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new BadRequestException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('You can only delete your own messages');
    await this.prisma.message.delete({ where: { id: messageId } });

    this.gateway.emitToUser(message.recipientId, 'messageDeleted', { id: messageId });
  }
}
