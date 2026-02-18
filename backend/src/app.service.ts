import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { CacheService } from './cache/cache.service';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  getHello(): string {
    return 'HeirLink API is running!';
  }

  /**
   * Health check: DB ping и опционально проверка AI-сервиса.
   * Возвращает status: 'ok' | 'degraded' (если AI недоступен).
   */
  async getHealth(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    db: 'up' | 'down';
    ai?: 'up' | 'down' | 'skipped';
    redis?: 'up' | 'down' | 'skipped';
  }> {
    const timestamp = new Date().toISOString();
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      const redis = await this.cacheService.ping();
      return { status: 'degraded', timestamp, db, redis };
    }

    const redis = await this.cacheService.ping();
    const aiUrl = this.config.get<string>('AI_SERVICE_URL');
    if (!aiUrl) {
      const status = db === 'up' && (redis === 'up' || redis === 'skipped') ? 'ok' : 'degraded';
      return { status, timestamp, db, ai: 'skipped', redis };
    }
    let ai: 'up' | 'down' = 'down';
    try {
      const res = await fetch(`${aiUrl.replace(/\/$/, '')}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      ai = res.ok ? 'up' : 'down';
    } catch {
      ai = 'down';
    }
    const status =
      db === 'up' && ai === 'up' && (redis === 'up' || redis === 'skipped')
        ? 'ok'
        : 'degraded';
    return { status, timestamp, db, ai, redis };
  }
}
