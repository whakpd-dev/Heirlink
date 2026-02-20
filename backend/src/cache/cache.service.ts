import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

const MAX_MEMORY_ENTRIES = 5000;

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private readonly memory = new Map<string, string>();

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL not set, using in-memory cache');
      return;
    }
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    this.redis.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
    this.memory.clear();
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.redis ? await this.redis.get(key) : this.memory.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.redis) {
      await this.redis.set(key, serialized, 'EX', ttlSeconds);
    } else {
      if (this.memory.size >= MAX_MEMORY_ENTRIES) {
        const firstKey = this.memory.keys().next().value;
        if (firstKey != null) this.memory.delete(firstKey);
      }
      this.memory.set(key, serialized);
      if (ttlSeconds > 0) {
        setTimeout(() => this.memory.delete(key), ttlSeconds * 1000).unref?.();
      }
    }
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(key);
    } else {
      this.memory.delete(key);
    }
  }

  isEnabled(): boolean {
    return !!this.redis;
  }

  async ping(): Promise<'up' | 'down' | 'skipped'> {
    if (!this.redis) return 'skipped';
    try {
      await this.redis.ping();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
