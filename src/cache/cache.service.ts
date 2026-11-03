import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin Redis wrapper used for read-heavy endpoints.
 *  - Disabled automatically when REDIS_URL is not set.
 *  - Fails OPEN: if Redis is down, callers just hit the database.
 *  - Invalidation uses version counters (INCR) instead of key scans.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;
  private warned = false;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      this.redis = null;
      this.logger.log('REDIS_URL not set - caching disabled');
      return;
    }
    this.redis = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });
    this.redis.on('error', (e) => this.warnOnce(e));
  }

  get enabled() {
    return this.redis !== null;
  }

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    if (this.redis) {
      try {
        const hit = await this.redis.get(key);
        if (hit !== null) return JSON.parse(hit) as T;
      } catch (e) {
        this.warnOnce(e);
      }
    }
    const fresh = await loader();
    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
      } catch (e) {
        this.warnOnce(e);
      }
    }
    return fresh;
  }

  /** Current version of a scope; part of every cache key for that scope. */
  async version(scope: string): Promise<string> {
    if (!this.redis) return '0';
    try {
      return (await this.redis.get(`ver:${scope}`)) ?? '0';
    } catch (e) {
      this.warnOnce(e);
      return '0';
    }
  }

  /** Invalidate every cached entry that includes this scope's version. */
  async bump(scope: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.incr(`ver:${scope}`);
    } catch (e) {
      this.warnOnce(e);
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  private warnOnce(e: unknown) {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn(`Redis unavailable, falling back to DB: ${(e as Error).message}`);
  }
}
