import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

export const CATALOG_VERSION_KEY = 'c:catalog:ver';

/**
 * Versioned invalidation for catalogue list caches (see
 * docs/architecture/data-architecture.md §2). List cache keys embed the
 * current version; an admin change bumps it, so stale keys are never read
 * again and simply expire by TTL. No KEYS/SCAN needed.
 */
@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);

  constructor(private readonly redisService: RedisService) {}

  async version(): Promise<string> {
    try {
      return (await this.redisService.get(CATALOG_VERSION_KEY)) || '0';
    } catch (error) {
      this.logger.warn(
        `Catalog version read failed: ${(error as Error).message}`,
      );
      return 'nocache';
    }
  }

  async bump(): Promise<void> {
    try {
      await this.redisService.getClient().incr(CATALOG_VERSION_KEY);
    } catch (error) {
      this.logger.error(
        `Catalog version bump failed: ${(error as Error).message}`,
      );
    }
  }
}
