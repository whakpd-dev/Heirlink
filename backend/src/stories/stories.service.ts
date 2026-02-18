import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto } from './dto/create-story.dto';

const STORY_TTL_HOURS = 24;
const USER_SELECT = { id: true, username: true, avatarUrl: true } as const;

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateStoryDto) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + STORY_TTL_HOURS);

    const story = await this.prisma.story.create({
      data: {
        userId,
        mediaUrl: dto.mediaUrl,
        type: dto.type,
        expiresAt,
      },
      include: {
        user: { select: USER_SELECT },
      },
    });

    return {
      id: story.id,
      mediaUrl: story.mediaUrl,
      type: story.type,
      expiresAt: story.expiresAt,
      createdAt: story.createdAt,
      user: story.user,
    };
  }

  async getFeed(userId: string) {
    const now = new Date();
    const following = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    const storiesByUser = await this.prisma.story.findMany({
      where: {
        userId: { in: followingIds },
        expiresAt: { gt: now },
      },
      include: {
        user: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    type UserInfo = { id: string; username: string; avatarUrl: string | null };
    const grouped = new Map<
      string,
      { user: UserInfo; stories: Array<{ id: string; mediaUrl: string; type: string; expiresAt: Date; createdAt: Date }> }
    >();
    for (const s of storiesByUser) {
      const key = s.userId;
      if (!grouped.has(key)) {
        grouped.set(key, { user: s.user, stories: [] });
      }
      grouped.get(key)!.stories.push({
        id: s.id,
        mediaUrl: s.mediaUrl,
        type: s.type,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      });
    }

    return Array.from(grouped.values());
  }

  async getMyStories(userId: string) {
    const now = new Date();
    const stories = await this.prisma.story.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
    });
    return stories.map((s) => ({
      id: s.id,
      mediaUrl: s.mediaUrl,
      type: s.type,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));
  }

  async remove(storyId: string, userId: string) {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
    });
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    if (story.userId !== userId) {
      throw new ForbiddenException('You can only delete your own story');
    }
    await this.prisma.story.delete({
      where: { id: storyId },
    });
  }
}
