import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL;
const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';

if (!redisUrl) {
  // eslint-disable-next-line no-console
  console.error('REDIS_URL not set, worker cannot start');
  process.exit(1);
}

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

new Worker(
  'notifications',
  async (job) => {
    const dto = job.data as {
      userId: string;
      type: string;
      actorId: string;
      postId?: string;
      commentId?: string;
    };
    if (dto.userId === dto.actorId) return;
    await prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        actorId: dto.actorId,
        postId: dto.postId ?? undefined,
        commentId: dto.commentId ?? undefined,
      },
    });
  },
  { connection },
);

new Worker(
  'smart-album',
  async (job) => {
    const payload = job.data as {
      jobId: string;
      mediaUrl: string;
      type?: string;
      userId: string;
    };

    const jobRow = await prisma.smartAlbumJob.findUnique({ where: { id: payload.jobId } });
    if (!jobRow || jobRow.status !== 'pending') return;

    await prisma.smartAlbumJob.update({
      where: { id: payload.jobId },
      data: { status: 'processing' },
    });

    try {
      const analyzeRes = await fetch(`${aiServiceUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: payload.mediaUrl }),
      });
      if (!analyzeRes.ok) throw new Error(`AI service returned ${analyzeRes.status}`);

      const data = (await analyzeRes.json()) as {
        status?: string;
        task_id?: string;
        analysis?: Record<string, unknown>;
      };

      if (data.status === 'completed' && data.analysis) {
        const item = await prisma.smartAlbumItem.create({
          data: {
            userId: payload.userId,
            originalMediaId: payload.mediaUrl,
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
        await prisma.smartAlbumJob.update({
          where: { id: payload.jobId },
          data: { status: 'done', resultItemId: item.id },
        });
        return;
      }

      if (data.status === 'processing' && data.task_id) {
        await prisma.smartAlbumJob.update({
          where: { id: payload.jobId },
          data: { aiTaskId: data.task_id },
        });
      }
    } catch (err: any) {
      await prisma.smartAlbumJob.update({
        where: { id: payload.jobId },
        data: {
          status: 'failed',
          errorMessage: err?.message ?? 'AI service error',
        },
      });
    }
  },
  { connection },
);

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
});
