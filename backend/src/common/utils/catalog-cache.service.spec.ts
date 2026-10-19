import {
  CatalogCacheService,
  CATALOG_VERSION_KEY,
} from './catalog-cache.service';
import { ProductsService } from '../../modules/products/products.service';

describe('CatalogCacheService', () => {
  it('reads and bumps the version with INCR (no KEYS/SCAN)', async () => {
    const client = { incr: jest.fn() };
    const redis = {
      get: jest.fn().mockResolvedValue('7'),
      getClient: () => client,
    };
    const cache = new CatalogCacheService(redis as any);
    await expect(cache.version()).resolves.toBe('7');
    await cache.bump();
    expect(client.incr).toHaveBeenCalledWith(CATALOG_VERSION_KEY);
  });

  it('degrades gracefully when Redis is down', async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('down')),
      getClient: () => ({
        incr: jest.fn().mockRejectedValue(new Error('down')),
      }),
    };
    const cache = new CatalogCacheService(redis as any);
    await expect(cache.version()).resolves.toBe('nocache');
    await expect(cache.bump()).resolves.toBeUndefined();
  });
});

describe('ProductsService public list', () => {
  it('uses versioned cache keys and only lists active, available products', async () => {
    const find = jest.fn(() => {
      const q: any = {
        skip: () => q,
        limit: () => q,
        sort: () => q,
        populate: () => q,
        exec: () => Promise.resolve([]),
      };
      return q;
    });
    const model = { find, countDocuments: jest.fn().mockResolvedValue(0) };
    const redis = {
      getJSON: jest.fn().mockResolvedValue(null),
      setJSON: jest.fn(),
    };
    const catalog = {
      version: jest.fn().mockResolvedValue('3'),
      bump: jest.fn(),
    };
    const service = new ProductsService(
      model as any,
      redis as any,
      { get: () => 300 } as any,
      catalog as any,
      {} as any,
    );

    await service.findAll({ page: 1, limit: 20 });

    expect(redis.getJSON).toHaveBeenCalledWith('products:v3:all:1:20');
    expect(find).toHaveBeenCalledWith({
      isAvailable: true,
      status: { $in: ['active', null] },
    });
  });
});
