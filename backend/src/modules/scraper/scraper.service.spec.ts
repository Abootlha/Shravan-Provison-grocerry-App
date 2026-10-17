import { BadRequestException, ConflictException } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mongoose from 'mongoose';
import { Connection, Model, Types } from 'mongoose';
import { ScraperService } from './scraper.service';
import {
  ScrapedProduct,
  ScrapedProductSchema,
  ScrapeStatus,
} from './schemas/scraped-product.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import {
  Subcategory,
  SubcategorySchema,
} from '../subcategories/schemas/subcategory.schema';
import {
  ItemGroup,
  ItemGroupSchema,
} from '../item-groups/schemas/item-group.schema';
import { ScrapeBlockedError } from './extract/product-extractor';
import { fetchPage } from './extract/page-fetcher';

jest.mock('./extract/page-fetcher', () => ({
  fetchPage: jest.fn(),
  renderWithBrowser: jest.fn().mockResolvedValue(null),
}));
const fetchPageMock = fetchPage as jest.MockedFunction<typeof fetchPage>;

const PAGE = `<script type="application/ld+json">${JSON.stringify({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { position: 1, item: { name: 'Home' } },
    { position: 2, item: { name: 'Dairy' } },
    { position: 3, item: { name: 'Milk' } },
    { position: 4, item: { name: 'Amul Gold' } },
  ],
})}</script><script type="application/ld+json">${JSON.stringify({
  '@type': 'Product',
  name: 'Amul Gold Full Cream Milk 500 ml',
  brand: 'Amul',
  image: [
    'https://shop.test/a.jpg',
    'https://shop.test/b.jpg',
    'https://shop.test/bad.jpg',
  ],
  offers: { price: 34 },
})}</script>`;

describe('ScraperService (MongoDB)', () => {
  let mongod: MongoMemoryServer;
  let connection: Connection;
  let scraped: Model<ScrapedProduct>;
  let products: Model<Product>;
  let service: ScraperService;
  const queue = { add: jest.fn() };
  const storage = {
    isConfigured: true,
    put: jest.fn((key: string) =>
      Promise.resolve(`https://cdn.store.test/${key}`),
    ),
    deleteMany: jest.fn(() => Promise.resolve()),
  };
  const imageProcessing = {
    processImage: jest.fn((url: string) => {
      if (url.includes('bad')) return Promise.reject(new Error('HTTP 404'));
      return Promise.resolve({
        buffer: Buffer.from(url),
        dataUri: 'data:image/png;base64,AA',
      });
    }),
  };
  let ids: { dairy: string; milk: string; snacks: string };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connection = await mongoose.createConnection(mongod.getUri()).asPromise();
    scraped = connection.model(ScrapedProduct.name, ScrapedProductSchema);
    products = connection.model(Product.name, ProductSchema);
    const categories = connection.model(Category.name, CategorySchema);
    const subcategories = connection.model(Subcategory.name, SubcategorySchema);
    const itemGroups = connection.model(ItemGroup.name, ItemGroupSchema);

    const dairy = await categories.create({ name: 'Dairy' });
    const snacks = await categories.create({ name: 'Snacks' });
    const milk = await subcategories.create({
      name: 'Milk',
      icon: 'milk',
      parentId: dairy._id,
    });
    ids = {
      dairy: String(dairy._id),
      milk: String(milk._id),
      snacks: String(snacks._id),
    };

    const productsService = {
      create: jest.fn(async (data: any) => products.create(data)),
    };
    service = new ScraperService(
      scraped as any,
      products as any,
      categories as any,
      subcategories as any,
      itemGroups as any,
      queue as any,
      productsService as any,
      imageProcessing as any,
      storage as any,
      { get: () => undefined } as any,
    );
  }, 180000);

  afterAll(async () => {
    await connection?.close();
    await mongod?.stop();
  });

  beforeEach(async () => {
    await scraped.deleteMany({});
    await products.deleteMany({});
    jest.clearAllMocks();
    fetchPageMock.mockResolvedValue(PAGE);
  });

  async function scrapeOne(url = 'https://shop.test/p/amul-gold') {
    const { queued } = await service.submit({ urls: [url] });
    expect(queued).toBe(1);
    const doc = await scraped.findOne({ sourceUrl: url });
    await service.process(String(doc!._id));
    return (await scraped.findById(doc!._id).lean())!;
  }

  it('queues links once, skipping duplicates and links already in the scraper', async () => {
    const first = await service.submit({
      urls: [
        'https://shop.test/p/1?utm_source=x',
        'https://shop.test/p/1',
        'https://shop.test/p/2',
      ],
    });
    expect(first.queued).toBe(2);
    expect(first.skipped).toEqual([
      { url: 'https://shop.test/p/1', reason: 'Listed twice' },
    ]);
    expect(queue.add).toHaveBeenCalledTimes(2);

    const again = await service.submit({ urls: ['https://shop.test/p/2'] });
    expect(again.queued).toBe(0);
    expect(again.skipped[0].reason).toBe('Already in the scraper');
  });

  it('scrapes into a ready preview with R2 images and a suggested category', async () => {
    const item = await scrapeOne();
    expect(item.status).toBe(ScrapeStatus.READY);
    expect(item).toMatchObject({
      name: 'Amul Gold Full Cream Milk 500 ml',
      brand: 'Amul',
      price: 34,
      mrp: 34,
      unit: '500 ml',
      sourceCategoryPath: ['Dairy', 'Milk'],
      imagesInR2: true,
    });
    expect(item.images.map((i) => i.sourceUrl)).toEqual([
      'https://shop.test/a.jpg',
      'https://shop.test/b.jpg',
    ]);
    expect(item.images[0].url).toMatch(
      /^https:\/\/cdn\.store\.test\/catalog\/scraped\//,
    );
    expect(item.warnings).toEqual(['1 image(s) could not be downloaded.']);
    expect(String(item.categoryId)).toBe(ids.dairy);
    expect(String(item.subcategoryId)).toBe(ids.milk);
    expect(item.suggestion?.confidence).toBe('high');
  });

  it('marks blocked pages as failed and lets them be retried', async () => {
    fetchPageMock.mockRejectedValue(
      new ScrapeBlockedError('The site blocked the scraper (HTTP 403).'),
    );
    const item = await scrapeOne();
    expect(item.status).toBe(ScrapeStatus.FAILED);
    expect(item.error).toContain('blocked');

    await service.retry(String(item._id));
    expect((await scraped.findById(item._id))!.status).toBe(
      ScrapeStatus.QUEUED,
    );
    expect(queue.add).toHaveBeenLastCalledWith(
      'scrape',
      { id: String(item._id) },
      expect.objectContaining({ jobId: `scrape-${String(item._id)}-1` }),
    );
  });

  it('approves into an active product with the R2 images and the chosen hierarchy', async () => {
    const item = await scrapeOne();
    const { product } = await service.approve(
      String(item._id),
      { stock: 12 },
      undefined,
    );

    const saved = (await products.findById(product._id).lean())!;
    expect(saved).toMatchObject({
      name: 'Amul Gold Full Cream Milk 500 ml',
      price: 34,
      stock: 12,
      unit: '500 ml',
      status: 'active',
    });
    expect(String(saved.categoryId)).toBe(ids.dairy);
    expect(saved.images).toEqual(item.images.map((i) => i.url));

    const after = (await scraped.findById(item._id).lean())!;
    expect(after.status).toBe(ScrapeStatus.APPROVED);
    expect(String(after.productId)).toBe(String(product._id));

    await expect(
      service.approve(String(item._id), {}, undefined),
    ).rejects.toThrow('already approved');
  });

  it('refuses to approve without required fields and stays in review', async () => {
    const item = await scrapeOne();
    await service.update(String(item._id), {
      categoryId: null,
      subcategoryId: null,
    });
    await expect(
      service.approve(String(item._id), {}, undefined),
    ).rejects.toThrow(BadRequestException);
    expect((await scraped.findById(item._id))!.status).toBe(ScrapeStatus.READY);
    expect(await products.countDocuments()).toBe(0);
  });

  it('rejects a subcategory from another category', async () => {
    const item = await scrapeOne();
    await expect(
      service.update(String(item._id), {
        categoryId: ids.snacks,
        subcategoryId: ids.milk,
      }),
    ).rejects.toThrow('not in the selected category');
  });

  it('removing an image deletes it from R2', async () => {
    const item = await scrapeOne();
    const [keep, drop] = item.images;
    const { item: updated } = await service.update(String(item._id), {
      imageUrls: [keep.url],
    });
    expect(updated.images.map((i: any) => i.url)).toEqual([keep.url]);
    expect(storage.deleteMany).toHaveBeenCalledWith([drop.key]);
  });

  it('declines: deletes the R2 images and frees the link for resubmission', async () => {
    const item = await scrapeOne();
    await service.decline(String(item._id), 'Not stocked', undefined);
    const after = (await scraped.findById(item._id).lean())!;
    expect(after).toMatchObject({
      status: ScrapeStatus.DECLINED,
      declineReason: 'Not stocked',
      images: [],
    });
    expect(storage.deleteMany).toHaveBeenCalledWith(
      item.images.map((i) => i.key),
    );

    await expect(
      service.decline(String(item._id), undefined, undefined),
    ).rejects.toThrow(ConflictException);
    expect((await service.submit({ urls: [item.sourceUrl] })).queued).toBe(1);
  });

  it('bulk approve reports each result', async () => {
    const a = await scrapeOne('https://shop.test/p/a');
    const b = await scrapeOne('https://shop.test/p/b');
    await service.update(String(b._id), {
      categoryId: null,
      subcategoryId: null,
    });
    const { results, approved } = await service.bulkApprove(
      [String(a._id), String(b._id)],
      'draft',
      String(new Types.ObjectId()),
    );
    expect(approved).toBe(1);
    expect(results[1]).toMatchObject({ ok: false });
    expect((await products.findOne().lean())!.status).toBe('draft');
  });

  it('counts by review state', async () => {
    await scrapeOne('https://shop.test/p/a');
    await service.submit({ urls: ['https://shop.test/p/queued'] });
    expect(await service.counts()).toMatchObject({
      ready: 1,
      in_progress: 1,
      all: 2,
    });
  });
});
