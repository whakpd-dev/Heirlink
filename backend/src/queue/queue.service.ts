import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { CreateNotificationDto } from '../notifications/notifications.service';

type SmartAlbumJobPayload = {
  jobId: string;
  mediaUrl: string;
  type?: string;
  userId: string;
};

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: Redis | null;
  private readonly notificationsQueue: Queue | null;
  private readonly smartAlbumQueue: Queue | null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.connection = null;
      this.notificationsQueue = null;
      this.smartAlbumQueue = null;
      this.logger.warn('REDIS_URL not set, queues are disabled');
      return;
    }
    this.connection = new Redis(url, { maxRetriesPerRequest: null });
    this.notificationsQueue = new Queue('notifications', { connection: this.connection });
    this.smartAlbumQueue = new Queue('smart-album', { connection: this.connection });
  }

  isEnabled() {
    return !!this.connection;
  }

  async enqueueNotification(dto: CreateNotificationDto) {
    if (!this.notificationsQueue) return;
    await this.notificationsQueue.add('notify', dto, {
      removeOnComplete: 500,
      removeOnFail: 1000,
    });
  }

  async enqueueSmartAlbumJob(payload: SmartAlbumJobPayload) {
    if (!this.smartAlbumQueue) return;
    await this.smartAlbumQueue.add('analyze', payload, {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}
