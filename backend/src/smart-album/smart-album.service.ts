import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import { QueueService } from '../queue/queue.service';

const AI_SERVICE_DEFAULT_URL = 'http://localhost:8000';

@Injectable()
export class SmartAlbumService {
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queueService: QueueService,
  ) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') ?? AI_SERVICE_DEFAULT_URL;
  }

  async createJob(userId: string, dto: UploadMediaDto) {
    const job = await this.prisma.smartAlbumJob.create({
      data: {
        userId,
        status: 'pending',
        mediaUrl: dto.mediaUrl,
      },
    });

    if (this.queueService.isEnabled()) {
      await this.queueService.enqueueSmartAlbumJob({
        jobId: job.id,
        mediaUrl: dto.mediaUrl,
        type: dto.type,
        userId,
      });
    } else {
      this.callAiServiceAndUpdateJob(job.id, dto.mediaUrl, dto.type).catch(
        (err) => {
          console.warn('[SmartAlbum] AI service call failed:', err?.message);
        },
      );
    }

    return {
      jobId: job.id,
      status: job.status,
      message: 'Job created. Poll GET /smart-album/jobs/:jobId for status.',
    };
  }

  private async callAiServiceAndUpdateJob(
    jobId: string,
    mediaUrl: string,
    type?: string,
  ) {
    const job = await this.prisma.smartAlbumJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status !== 'pending') return;

    await this.prisma.smartAlbumJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    try {
      const analyzeRes = await fetch(`${this.aiServiceUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: mediaUrl }),
      });
      if (!analyzeRes.ok) throw new Error(`AI service returned ${analyzeRes.status}`);

      const data = (await analyzeRes.json()) as {
        status?: string;
        task_id?: string;
        analysis?: Record<string, unknown>;
      };

      if (data.status === 'completed' && data.analysis) {
        const item = await this.prisma.smartAlbumItem.create({
          data: {
            userId: job.userId,
            originalMediaId: mediaUrl,
            aiAnalysis: (data.analysis ?? {}) as object,
            lifeMomentTags: data.analysis?.event_type
              ? ([data.analysis.event_type] as object)
              : undefined,
            locationData:
              typeof data.analysis?.location === 'string'
                ? ({ location: data.analysis.location } as object)
                : undefined,
          },
        });
        await this.prisma.smartAlbumJob.update({
          where: { id: jobId },
          data: { status: 'done', resultItemId: item.id },
        });
        return;
      }

      if (data.status === 'processing' && data.task_id) {
        await this.prisma.smartAlbumJob.update({
          where: { id: jobId },
          data: { aiTaskId: data.task_id },
        });
      }
    } catch (err: any) {
      await this.prisma.smartAlbumJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMessage: err?.message ?? 'AI service error',
        },
      });
    }
  }

  async getJob(jobId: string, userId: string) {
    const job = await this.prisma.smartAlbumJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.userId !== userId) throw new ForbiddenException('Not your job');

    if (job.status === 'processing' && job.aiTaskId) {
      this.checkAiTaskStatus(jobId, job.aiTaskId, job.userId, job.mediaUrl).catch(() => {});
    }

    return {
      jobId: job.id,
      status: job.status,
      resultItemId: job.resultItemId ?? undefined,
      errorMessage: job.errorMessage ?? undefined,
      createdAt: job.createdAt,
    };
  }

  private async checkAiTaskStatus(jobId: string, aiTaskId: string, userId: string, mediaUrl: string) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `${this.aiServiceUrl}/api/task/${encodeURIComponent(aiTaskId)}`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) return;
      const data = (await res.json()) as { status?: string; analysis?: Record<string, unknown> };
      if (data.status !== 'completed') return;

      const item = await this.prisma.smartAlbumItem.create({
        data: {
          userId,
          originalMediaId: mediaUrl,
          aiAnalysis: (data.analysis ?? {}) as object,
        },
      });
      await this.prisma.smartAlbumJob.update({
        where: { id: jobId },
        data: { status: 'done', resultItemId: item.id },
      });
    } catch {
      // Non-blocking: status will update on next poll
    }
  }

  async getItems(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const limitClamped = Math.min(Math.max(limit, 1), 100);

    const [items, total] = await Promise.all([
      this.prisma.smartAlbumItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitClamped,
      }),
      this.prisma.smartAlbumItem.count({ where: { userId } }),
    ]);

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

  async getItem(itemId: string, userId: string) {
    const item = await this.prisma.smartAlbumItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.userId !== userId) throw new ForbiddenException('Not your item');
    return item;
  }
}
