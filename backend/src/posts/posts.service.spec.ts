import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../cache/cache.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

const mockPost = {
  id: 'post-1',
  userId: 'user-1',
  caption: 'Test post',
  location: null,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 'user-1', username: 'testuser', avatarUrl: null },
  media: [{ id: 'm-1', url: '/uploads/test.jpg', type: 'photo', order: 0 }],
  _count: { likes: 0, comments: 0 },
};

describe('PostsService', () => {
  let service: PostsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      post: {
        create: jest.fn().mockResolvedValue(mockPost),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([mockPost]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(mockPost),
      },
      like: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      savedPost: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: CacheService, useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  describe('create', () => {
    it('should create a post with media', async () => {
      const dto = {
        caption: 'Test post',
        media: [{ url: '/uploads/test.jpg', type: 'photo' as const }],
      };

      const result = await service.create('user-1', dto);
      expect(result.id).toBe('post-1');
      expect(prisma.post.create).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException for non-existent post', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return the post when found', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);

      const result = await service.findOne('post-1');
      expect(result).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should throw ForbiddenException for unauthorized deletion', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);

      await expect(service.delete('post-1', 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('should soft-delete the post for the owner', async () => {
      prisma.post.findUnique.mockResolvedValue(mockPost);

      await service.delete('post-1', 'user-1');
      expect(prisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: expect.objectContaining({ isDeleted: true }),
        }),
      );
    });
  });
});
