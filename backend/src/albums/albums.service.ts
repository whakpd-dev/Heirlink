import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class AlbumsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  async create(userId: string, dto: CreateAlbumDto) {
    return this.prisma.album.create({
      data: {
        ownerId: userId,
        name: dto.name,
        visibility: dto.visibility ?? 'private',
      },
      include: { owner: { select: { id: true, username: true, avatarUrl: true } } },
    });
  }

  async findMyAlbums(userId: string) {
    const owned = await this.prisma.album.findMany({
      where: { ownerId: userId },
      include: {
        _count: { select: { items: true, members: true } },
        items: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { media: { select: { url: true, type: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const memberOf = await this.prisma.album.findMany({
      where: {
        members: { some: { userId } },
        ownerId: { not: userId },
      },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { items: true, members: true } },
        items: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { media: { select: { url: true, type: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { owned, memberOf };
  }

  async findUserAlbums(userId: string, requesterId?: string) {
    const where: any = { ownerId: userId };

    if (requesterId !== userId) {
      where.OR = [
        { visibility: 'public' },
        { members: { some: { userId: requesterId } } },
      ];
      delete where.ownerId;
      where.AND = [{ ownerId: userId }];
    }

    return this.prisma.album.findMany({
      where: requesterId === userId ? { ownerId: userId } : {
        ownerId: userId,
        OR: [
          { visibility: 'public' },
          ...(requesterId ? [{ members: { some: { userId: requesterId } } }] : []),
        ],
      },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { items: true, members: true } },
        items: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { media: { select: { url: true, type: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(albumId: string, requesterId: string) {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: {
        owner: { select: { id: true, username: true, avatarUrl: true } },
        members: {
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
        _count: { select: { items: true } },
      },
    });
    if (!album) throw new NotFoundException('Album not found');
    this.assertCanView(album, requesterId);
    return album;
  }

  async getItems(albumId: string, requesterId: string, cursor?: string, limit = 20) {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: { members: { select: { userId: true } } },
    });
    if (!album) throw new NotFoundException('Album not found');
    this.assertCanView({ ...album, owner: { id: album.ownerId } } as any, requesterId);

    return this.prisma.albumItem.findMany({
      where: { albumId },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        media: { select: { id: true, url: true, type: true, thumbnailUrl: true } },
        addedBy: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async update(albumId: string, userId: string, dto: UpdateAlbumDto) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Album not found');
    if (album.ownerId !== userId) throw new ForbiddenException('Only the owner can edit');

    return this.prisma.album.update({
      where: { id: albumId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
        ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
      },
    });
  }

  async remove(albumId: string, userId: string) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Album not found');
    if (album.ownerId !== userId) throw new ForbiddenException('Only the owner can delete');
    await this.prisma.album.delete({ where: { id: albumId } });
    return { deleted: true };
  }

  async addItem(
    albumId: string,
    userId: string,
    file: Express.Multer.File,
    caption?: string,
  ) {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: { members: { select: { userId: true, role: true } } },
    });
    if (!album) throw new NotFoundException('Album not found');
    this.assertCanEdit(album, userId);

    this.uploadService.validateFile(file.mimetype, file.size, 'albums', file.buffer);
    const { url, mimetype } = await this.uploadService.saveFile(file, 'albums');

    const isVideo = mimetype.startsWith('video/');

    const media = await this.prisma.media.create({
      data: { url, type: isVideo ? 'video' : 'photo' },
    });

    const item = await this.prisma.albumItem.create({
      data: {
        albumId,
        addedById: userId,
        caption,
        mediaId: media.id,
      },
      include: {
        media: { select: { id: true, url: true, type: true } },
        addedBy: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    if (!album.coverUrl) {
      await this.prisma.album.update({
        where: { id: albumId },
        data: { coverUrl: url },
      });
    }

    // Send notification to owner + members (except the uploader)
    const recipientIds = [
      album.ownerId,
      ...album.members.map((m) => m.userId),
    ].filter((id) => id !== userId);

    if (recipientIds.length > 0) {
      await this.prisma.notification.createMany({
        data: recipientIds.map((recipientId) => ({
          userId: recipientId,
          type: 'album_new_item',
          actorId: userId,
          albumId,
        })),
      });
    }

    return item;
  }

  async removeItem(albumId: string, itemId: string, userId: string) {
    const item = await this.prisma.albumItem.findFirst({
      where: { id: itemId, albumId },
      include: { album: { select: { ownerId: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.addedById !== userId && item.album.ownerId !== userId) {
      throw new ForbiddenException('Cannot remove this item');
    }
    await this.prisma.albumItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  async addMember(albumId: string, userId: string, dto: AddMemberDto) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Album not found');
    if (album.ownerId !== userId) throw new ForbiddenException('Only the owner can add members');
    if (dto.userId === userId) throw new BadRequestException('Cannot add yourself');

    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser) throw new NotFoundException('User not found');

    const member = await this.prisma.albumMember.upsert({
      where: { albumId_userId: { albumId, userId: dto.userId } },
      create: {
        albumId,
        userId: dto.userId,
        role: dto.role ?? 'editor',
      },
      update: { role: dto.role ?? 'editor' },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });

    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: 'album_invite',
        actorId: userId,
        albumId,
      },
    });

    return member;
  }

  async removeMember(albumId: string, targetUserId: string, requesterId: string) {
    const album = await this.prisma.album.findUnique({ where: { id: albumId } });
    if (!album) throw new NotFoundException('Album not found');

    const isSelf = targetUserId === requesterId;
    if (!isSelf && album.ownerId !== requesterId) {
      throw new ForbiddenException('Only the owner can remove members');
    }

    await this.prisma.albumMember.deleteMany({
      where: { albumId, userId: targetUserId },
    });
    return { removed: true };
  }

  async getMembers(albumId: string, requesterId: string) {
    const album = await this.prisma.album.findUnique({
      where: { id: albumId },
      include: { members: { select: { userId: true } } },
    });
    if (!album) throw new NotFoundException('Album not found');
    this.assertCanView({ ...album, owner: { id: album.ownerId } } as any, requesterId);

    return this.prisma.albumMember.findMany({
      where: { albumId },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  private assertCanView(
    album: { visibility: string; owner: { id: string }; members?: { userId: string }[] },
    userId: string,
  ) {
    if (album.visibility === 'public') return;
    if (album.owner.id === userId) return;
    if (album.members?.some((m) => m.userId === userId)) return;
    throw new ForbiddenException('Access denied');
  }

  private assertCanEdit(
    album: { ownerId: string; members: { userId: string; role: string }[] },
    userId: string,
  ) {
    if (album.ownerId === userId) return;
    const membership = album.members.find((m) => m.userId === userId);
    if (membership?.role === 'editor') return;
    throw new ForbiddenException('You do not have edit access');
  }
}
