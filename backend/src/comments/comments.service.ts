import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

const USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(postId: string, userId: string, dto: CreateCommentDto) {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.post.findUnique({
        where: { id: postId },
      });
      if (!post || post.isDeleted) {
        throw new NotFoundException('Post not found');
      }

      let parent: { userId: string } | null = null;
      if (dto.parentId) {
        parent = await tx.comment.findFirst({
          where: { id: dto.parentId, postId },
          select: { userId: true },
        });
        if (!parent) {
          throw new BadRequestException('Parent comment not found or does not belong to this post');
        }
      }

      const comment = await tx.comment.create({
        data: {
          postId,
          userId,
          text: dto.text.trim(),
          parentId: dto.parentId || undefined,
        },
        include: {
          user: { select: USER_SELECT },
        },
      });

      // Notify post owner (unless they commented)
      if (post.userId !== userId) {
        await this.notificationsService.create(
          {
            userId: post.userId,
            type: 'comment',
            actorId: userId,
            postId,
            commentId: comment.id,
          },
          tx,
        );
      }
      // Notify parent comment author on reply (unless they replied to themselves)
      if (parent && parent.userId !== userId) {
        await this.notificationsService.create(
          {
            userId: parent.userId,
            type: 'comment_reply',
            actorId: userId,
            postId,
            commentId: comment.id,
          },
          tx,
        );
      }

      return comment;
    });
  }

  async findByPostId(postId: string, page: number, limit: number, cursor?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post || post.isDeleted) {
      throw new NotFoundException('Post not found');
    }

    const limitClamped = Math.min(Math.max(limit, 1), 100);

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { postId, parentId: null },
        include: {
          user: { select: USER_SELECT },
          replies: {
            include: {
              user: { select: USER_SELECT },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: (page - 1) * limitClamped }),
        take: limitClamped,
      }),
      cursor
        ? Promise.resolve(undefined)
        : this.prisma.comment.count({
            where: { postId, parentId: null },
          }),
    ]);

    return {
      comments,
      pagination: {
        page,
        limit: limitClamped,
        total,
        totalPages: total != null ? Math.ceil(total / limitClamped) : undefined,
        nextCursor: comments.length === limitClamped ? comments[comments.length - 1].id : undefined,
      },
    };
  }

  async update(commentId: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comment');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { text: dto.text.trim() },
      include: {
        user: { select: USER_SELECT },
      },
    });

    return updated;
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comment');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });
  }
}
