import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async create(reporterId: string, dto: CreateReportDto) {
    const existing = await this.prisma.report.findUnique({
      where: {
        reporterId_targetType_targetId: {
          reporterId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Вы уже отправляли жалобу на этот контент');
    }
    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
      },
    });
  }

  async findAll(status?: string, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { reporter: { select: { id: true, username: true, avatarUrl: true } } },
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
