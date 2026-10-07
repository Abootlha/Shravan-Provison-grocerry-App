import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly ORDER_CACHE_TTL = 300; // 5 minutes

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get an order from cache
   * Returns null if not found or on Redis error (fallback behavior)
   */
  async getOrder<T>(orderId: string): Promise<T | null> {
    try {
      const cacheKey = this.getOrderCacheKey(orderId);
      const cached = await this.redisService.getJSON<T>(cacheKey);

      if (cached) {
        this.logger.debug(`Cache hit for order ${orderId}`);
      } else {
        this.logger.debug(`Cache miss for order ${orderId}`);
      }

      return cached;
    } catch (error) {
      this.logger.error(
        `Redis get error for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Fallback: return null to trigger database query
      return null;
    }
  }

  /**
   * Set an order in cache with 5-minute TTL
   * Silently fails on Redis error (graceful degradation)
   */
  async setOrder<T>(orderId: string, order: T): Promise<void> {
    try {
      const cacheKey = this.getOrderCacheKey(orderId);
      await this.redisService.setJSON(cacheKey, order, this.ORDER_CACHE_TTL);
      this.logger.debug(
        `Cached order ${orderId} with TTL ${this.ORDER_CACHE_TTL}s`,
      );
    } catch (error) {
      this.logger.error(
        `Redis set error for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Graceful degradation: continue without caching
    }
  }

  /**
   * Delete an order from cache (invalidation)
   * Silently fails on Redis error
   */
  async deleteOrder(orderId: string): Promise<void> {
    try {
      const cacheKey = this.getOrderCacheKey(orderId);
      await this.redisService.del(cacheKey);
      this.logger.debug(`Invalidated cache for order ${orderId}`);
    } catch (error) {
      this.logger.error(
        `Redis delete error for order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Graceful degradation: continue without invalidation
    }
  }

  private getOrderCacheKey(orderId: string): string {
    return `order:${orderId}`;
  }
}
