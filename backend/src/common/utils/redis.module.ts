import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { CatalogCacheService } from './catalog-cache.service';

@Global()
@Module({
  providers: [RedisService, CacheService, CatalogCacheService],
  exports: [RedisService, CacheService, CatalogCacheService],
})
export class RedisModule {}
