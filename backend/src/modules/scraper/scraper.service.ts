import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { createHash, randomUUID } from 'crypto';
import {
  OPEN_SCRAPE_STATUSES,
  ScrapedImage,
  ScrapedProduct,
  ScrapedProductDocument,
  ScrapeStatus,
} from './schemas/scraped-product.schema';
import {
  Product,
  ProductDocument,
  ProductStatus,
  StorageType,
  DietaryType,
} from '../products/schemas/product.schema';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import {
  Subcategory,
  SubcategoryDocument,
} from '../subcategories/schemas/subcategory.schema';
import {
  ItemGroup,
  ItemGroupDocument,
} from '../item-groups/schemas/item-group.schema';
import { ProductsService } from '../products/products.service';
import { ImageProcessingService } from '../products/image-processing/image-processing.service';
import { R2StorageService } from '../../common/storage/r2-storage.service';
import { escapeRegex, pageMeta } from '../../common/dto/query-transforms';
import {
  ExtractedProduct,
  ScrapeBlockedError,
  ScrapeParseError,
  detectSite,
  extractProduct,
  normalizeSourceUrl,
} from './extract/product-extractor';
import { fetchPage, renderWithBrowser } from './extract/page-fetcher';
import { Taxonomy, suggestCategory } from './categorizer';
import {
  ApproveScrapedProductDto,
  ScrapeListQueryDto,
  SubmitScrapeDto,
  UpdateScrapedProductDto,
} from './dto/scraper.dto';

export const SCRAPE_QUEUE = 'product-scrape';

/** Without R2, images are stored as data URIs on the document: keep it small. */
const MAX_INLINE_IMAGES = 4;
const IMAGE_CONCURRENCY = 3;

const IN_PROGRESS = [
  ScrapeStatus.QUEUED,
  ScrapeStatus.SCRAPING,
  ScrapeStatus.APPROVING,
];

interface ScraperConfig {
  storeEmail: string;
  timeoutMs: number;
  maxImages: number;
  browser: 'auto' | 'off';
}

export interface BulkResult {
  id: string;
  ok: boolean;
  message?: string;
  productId?: string;
}

const oid = (id?: string | null) => (id ? new Types.ObjectId(id) : undefined);
const idOf = (value: Types.ObjectId | string | null | undefined) =>
  value ? value.toString() : undefined;

@Injectable()
export class ScraperService implements OnModuleInit {
  private readonly logger = new Logger(ScraperService.name);
  private readonly config: ScraperConfig;

  constructor(
    @InjectModel(ScrapedProduct.name)
    private scrapedModel: Model<ScrapedProductDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
    @InjectModel(ItemGroup.name)
    private itemGroupModel: Model<ItemGroupDocument>,
    @InjectQueue(SCRAPE_QUEUE) private queue: Queue,
    private productsService: ProductsService,
    private imageProcessing: ImageProcessingService,
    private storage: R2StorageService,
    configService: ConfigService,
  ) {
    this.config = configService.get<ScraperConfig>('scraper') ?? {
      storeEmail: 'support@shravanprovision.com',
      timeoutMs: 30000,
      maxImages: 8,
      browser: 'auto',
    };
  }

  /**
   * Recovers work interrupted by a restart: rows left "scraping" are queued
   * again, queued rows get their job back (BullMQ ignores a duplicate job id)
   * and a half-done approval returns to review.
   */
  async onModuleInit() {
    try {
      await this.scrapedModel.updateMany(
        { status: ScrapeStatus.APPROVING, productId: { $exists: false } },
        { $set: { status: ScrapeStatus.READY } },
      );
      await this.scrapedModel.updateMany(
        { status: ScrapeStatus.SCRAPING },
        { $set: { status: ScrapeStatus.QUEUED } },
      );
      const queued = await this.scrapedModel
        .find({ status: ScrapeStatus.QUEUED })
        .select('_id attempts')
        .lean();
      for (const row of queued) await this.enqueue(row);
      if (queued.length) {
        this.logger.log(`Re-queued ${queued.length} scrape job(s)`);
      }
    } catch (error) {
      this.logger.warn(`Scrape recovery skipped: ${(error as Error).message}`);
    }
  }

  status() {
    return {
      r2Configured: this.storage.isConfigured,
      browser: this.config.browser,
      maxImages: this.storageLimit(),
    };
  }

  private storageLimit() {
    return this.storage.isConfigured
      ? this.config.maxImages
      : Math.min(this.config.maxImages, MAX_INLINE_IMAGES);
  }

  private enqueue(row: { _id: unknown; attempts?: number }) {
    const id = String(row._id);
    return this.queue.add(
      'scrape',
      { id },
      {
        jobId: `scrape-${id}-${row.attempts ?? 0}`,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: 200,
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Submit

  async submit(dto: SubmitScrapeDto, userId?: string) {
    if (dto.categoryId || dto.subcategoryId || dto.itemGroupId) {
      await this.assertHierarchy(
        dto.categoryId,
        dto.subcategoryId,
        dto.itemGroupId,
      );
    }

    const skipped: { url: string; reason: string }[] = [];
    const unique = new Map<string, string>();
    for (const raw of dto.urls) {
      let url: string;
      try {
        url = normalizeSourceUrl(raw);
      } catch {
        skipped.push({ url: raw, reason: 'Not a valid link' });
        continue;
      }
      if (unique.has(url)) {
        skipped.push({ url: raw, reason: 'Listed twice' });
        continue;
      }
      unique.set(url, raw);
    }

    const existing = await this.scrapedModel
      .find({
        sourceUrl: { $in: [...unique.keys()] },
        status: { $in: OPEN_SCRAPE_STATUSES },
      })
      .select('sourceUrl status')
      .lean();
    for (const row of existing) {
      skipped.push({
        url: unique.get(row.sourceUrl) ?? row.sourceUrl,
        reason:
          row.status === ScrapeStatus.APPROVED
            ? 'Already imported'
            : 'Already in the scraper',
      });
      unique.delete(row.sourceUrl);
    }

    const batchId = randomUUID().slice(0, 8);
    const docs = await this.scrapedModel.insertMany(
      [...unique.keys()].map((sourceUrl) => ({
        sourceUrl,
        sourceSite: detectSite(sourceUrl),
        status: ScrapeStatus.QUEUED,
        batchId,
        requestedBy: oid(userId),
        categoryId: oid(dto.categoryId),
        subcategoryId: oid(dto.subcategoryId),
        itemGroupId: oid(dto.itemGroupId),
      })),
    );
    for (const doc of docs) await this.enqueue(doc);

    return { batchId, queued: docs.length, skipped };
  }

  async retry(id: string) {
    const doc = await this.scrapedModel.findOneAndUpdate(
      { _id: id, status: ScrapeStatus.FAILED },
      { $set: { status: ScrapeStatus.QUEUED }, $unset: { error: 1 } },
      { new: true },
    );
    if (!doc) {
      await this.mustFind(id);
      throw new ConflictException('Only failed links can be retried.');
    }
    await this.enqueue(doc);
    return { item: doc.toObject() };
  }

  // ---------------------------------------------------------------------------
  // Scrape job

  async process(id: string): Promise<void> {
    const doc = await this.scrapedModel.findOneAndUpdate(
      { _id: id, status: ScrapeStatus.QUEUED },
      {
        $set: { status: ScrapeStatus.SCRAPING, warnings: [] },
        $inc: { attempts: 1 },
        $unset: { error: 1 },
      },
      { new: true },
    );
    if (!doc) return; // already handled, retried or deleted

    const uploadedKeys: string[] = [];
    try {
      const extracted = await this.scrapePage(doc.sourceUrl);
      const warnings: string[] = [];
      const images = await this.storeImages(
        String(doc._id),
        extracted.images,
        warnings,
        uploadedKeys,
      );
      if (!extracted.price) warnings.push('No price found on the page.');
      if (!images.length) warnings.push('No product images could be saved.');

      const suggestion = suggestCategory(await this.loadTaxonomy(), {
        categoryPath: extracted.categoryPath,
        name: extracted.name,
        brand: extracted.brand,
      });
      const useSuggestion =
        !doc.categoryId && suggestion && suggestion.confidence !== 'low';

      const duplicate = await this.productModel
        .findOne({
          name: { $regex: `^${escapeRegex(extracted.name)}$`, $options: 'i' },
        })
        .select('_id')
        .lean();

      await this.scrapedModel.updateOne(
        { _id: doc._id, status: ScrapeStatus.SCRAPING },
        {
          $set: {
            status: ScrapeStatus.READY,
            sourceSite: extracted.site,
            sourceId: extracted.sourceId,
            name: extracted.name,
            brand: extracted.brand,
            description: extracted.description,
            highlights: extracted.highlights,
            price: extracted.price,
            mrp: extracted.mrp,
            unit: extracted.unit,
            images,
            imagesInR2: this.storage.isConfigured,
            sourceCategoryPath: extracted.categoryPath,
            shelfLifeDays: extracted.shelfLifeDays,
            dietary: extracted.dietary,
            storage: extracted.storage,
            nutrition: extracted.nutrition,
            suggestion: suggestion
              ? {
                  categoryId: oid(suggestion.categoryId),
                  subcategoryId: oid(suggestion.subcategoryId),
                  itemGroupId: oid(suggestion.itemGroupId),
                  confidence: suggestion.confidence,
                  score: suggestion.score,
                  matched: suggestion.matched,
                }
              : undefined,
            ...(useSuggestion
              ? {
                  categoryId: oid(suggestion.categoryId),
                  subcategoryId: oid(suggestion.subcategoryId),
                  itemGroupId: oid(suggestion.itemGroupId),
                }
              : {}),
            duplicateOf: duplicate?._id,
            warnings,
          },
        },
      );
    } catch (error) {
      await this.storage.deleteMany(uploadedKeys);
      const message =
        error instanceof ScrapeBlockedError || error instanceof ScrapeParseError
          ? error.message
          : `Scraping failed: ${(error as Error).message}`;
      this.logger.warn(`Scrape ${id} failed: ${message}`);
      await this.scrapedModel.updateOne(
        { _id: doc._id },
        { $set: { status: ScrapeStatus.FAILED, error: message.slice(0, 500) } },
      );
    }
  }

  /** Plain fetch first; a headless browser (if installed) when that is not enough. */
  private async scrapePage(url: string): Promise<ExtractedProduct> {
    let firstError: Error | null = null;
    try {
      const html = await fetchPage(url, { timeoutMs: this.config.timeoutMs });
      return extractProduct(html, url, this.config.storeEmail);
    } catch (error) {
      firstError = error as Error;
    }
    if (this.config.browser !== 'off') {
      const html = await renderWithBrowser(url, this.config.timeoutMs).catch(
        (error: Error) => {
          this.logger.warn(
            `Browser render failed for ${url}: ${error.message}`,
          );
          return null;
        },
      );
      if (html) return extractProduct(html, url, this.config.storeEmail);
    }
    throw firstError;
  }

  /** Downloads, normalises (800px pack shot) and stores each image. */
  private async storeImages(
    id: string,
    sources: string[],
    warnings: string[],
    uploadedKeys: string[],
  ): Promise<ScrapedImage[]> {
    const wanted = sources.slice(0, this.storageLimit());
    const results: (ScrapedImage | null)[] = new Array(wanted.length).fill(
      null,
    );
    let next = 0;
    let failed = 0;
    const worker = async () => {
      while (next < wanted.length) {
        const index = next++;
        const sourceUrl = wanted[index];
        try {
          const processed = await this.imageProcessing.processImage(sourceUrl, {
            removeBackground: false,
          });
          if (this.storage.isConfigured) {
            const hash = createHash('sha1')
              .update(processed.buffer)
              .digest('hex')
              .slice(0, 12);
            const key = `catalog/scraped/${id}/${index}-${hash}.png`;
            const url = await this.storage.put(
              key,
              processed.buffer,
              'image/png',
            );
            uploadedKeys.push(key);
            results[index] = { url, key, sourceUrl };
          } else {
            results[index] = { url: processed.dataUri, sourceUrl };
          }
        } catch (error) {
          failed++;
          this.logger.warn(
            `Image ${sourceUrl} skipped: ${(error as Error).message}`,
          );
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(IMAGE_CONCURRENCY, wanted.length) },
        worker,
      ),
    );
    if (failed) warnings.push(`${failed} image(s) could not be downloaded.`);
    return results.filter((r): r is ScrapedImage => r !== null);
  }

  private async loadTaxonomy(): Promise<Taxonomy> {
    const [categories, subcategories, itemGroups] = await Promise.all([
      this.categoryModel.find().select('name isActive').lean(),
      this.subcategoryModel.find().select('name parentId isActive').lean(),
      this.itemGroupModel
        .find()
        .select('name subcategoryId tags isActive')
        .lean(),
    ]);
    return {
      categories: categories.map((c: any) => ({
        _id: String(c._id),
        name: c.name,
        isActive: c.isActive,
      })),
      subcategories: subcategories.map((s: any) => ({
        _id: String(s._id),
        name: s.name,
        parentId: idOf(s.parentId),
        isActive: s.isActive,
      })),
      itemGroups: itemGroups.map((g: any) => ({
        _id: String(g._id),
        name: g.name,
        parentId: idOf(g.subcategoryId),
        tags: g.tags,
        isActive: g.isActive,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Read

  async list(query: ScrapeListQueryDto) {
    const filter: Record<string, any> = {};
    if (query.status === 'in_progress') filter.status = { $in: IN_PROGRESS };
    else if (query.status) filter.status = query.status;
    if (query.batchId) filter.batchId = query.batchId;
    if (query.q?.trim()) {
      const re = { $regex: escapeRegex(query.q.trim()), $options: 'i' };
      filter.$or = [{ name: re }, { brand: re }, { sourceUrl: re }];
    }
    const { page, limit } = query;
    const [items, total] = await Promise.all([
      this.scrapedModel.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        // Lists only need the cover image (inline images can be large).
        {
          $addFields: {
            imageCount: { $size: { $ifNull: ['$images', []] } },
            images: { $slice: [{ $ifNull: ['$images', []] }, 1] },
          },
        },
        { $project: { description: 0, highlights: 0, nutrition: 0 } },
      ]),
      this.scrapedModel.countDocuments(filter),
    ]);
    return { items, ...pageMeta(total, page, limit) };
  }

  async counts() {
    const rows = await this.scrapedModel.aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    const by = Object.fromEntries(rows.map((r) => [r._id, r.n])) as Record<
      string,
      number
    >;
    const n = (s: ScrapeStatus) => by[s] ?? 0;
    return {
      ready: n(ScrapeStatus.READY),
      in_progress: IN_PROGRESS.reduce((sum, s) => sum + n(s), 0),
      failed: n(ScrapeStatus.FAILED),
      approved: n(ScrapeStatus.APPROVED),
      declined: n(ScrapeStatus.DECLINED),
      all: rows.reduce((sum, r) => sum + r.n, 0),
    };
  }

  async get(id: string) {
    const doc = await this.mustFind(id);
    return { item: doc.toObject() };
  }

  private async mustFind(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Not found.');
    const doc = await this.scrapedModel.findById(id);
    if (!doc)
      throw new NotFoundException('This scraped product no longer exists.');
    return doc;
  }

  // ---------------------------------------------------------------------------
  // Review

  async update(id: string, dto: UpdateScrapedProductDto) {
    const doc = await this.mustFind(id);
    if (doc.status !== ScrapeStatus.READY) {
      throw new ConflictException(
        'Only products waiting for review can be edited.',
      );
    }
    await this.applyEdits(doc, dto);
    await doc.save();
    return { item: doc.toObject() };
  }

  private async applyEdits(
    doc: ScrapedProductDocument,
    dto: UpdateScrapedProductDto,
  ) {
    const text = [
      'name',
      'brand',
      'description',
      'highlights',
      'unit',
      'barcode',
    ] as const;
    for (const key of text) {
      if (dto[key] !== undefined)
        (doc as any)[key] = dto[key].trim() || undefined;
    }
    if (dto.price !== undefined) doc.price = dto.price;
    if (dto.mrp !== undefined) doc.mrp = dto.mrp;
    if (dto.stock !== undefined) doc.stock = dto.stock;

    const touchesHierarchy =
      dto.categoryId !== undefined ||
      dto.subcategoryId !== undefined ||
      dto.itemGroupId !== undefined;
    if (touchesHierarchy) {
      const pick = (
        v: string | null | undefined,
        current: Types.ObjectId | undefined,
      ) => (v === undefined ? idOf(current) : v || undefined);
      const categoryId = pick(dto.categoryId, doc.categoryId);
      const subcategoryId = pick(dto.subcategoryId, doc.subcategoryId);
      const itemGroupId = pick(dto.itemGroupId, doc.itemGroupId);
      await this.assertHierarchy(categoryId, subcategoryId, itemGroupId);
      doc.categoryId = oid(categoryId);
      doc.subcategoryId = oid(subcategoryId);
      doc.itemGroupId = oid(itemGroupId);
    }

    if (dto.imageUrls !== undefined) {
      const byUrl = new Map(doc.images.map((img) => [img.url, img]));
      const kept: ScrapedImage[] = [];
      for (const url of dto.imageUrls) {
        const img = byUrl.get(url);
        if (img && !kept.includes(img)) kept.push(img);
      }
      const removedKeys = doc.images
        .filter((img) => !kept.includes(img) && img.key)
        .map((img) => img.key!);
      doc.images = kept;
      await this.storage.deleteMany(removedKeys);
    }
  }

  async approve(id: string, dto: ApproveScrapedProductDto, userId?: string) {
    const { publishAs, ...edits } = dto;
    if (Object.values(edits).some((v) => v !== undefined)) {
      await this.update(id, edits);
    }

    const doc = await this.scrapedModel.findOneAndUpdate(
      { _id: id, status: ScrapeStatus.READY },
      { $set: { status: ScrapeStatus.APPROVING } },
      { new: true },
    );
    if (!doc) {
      const current = await this.mustFind(id);
      throw new ConflictException(
        current.status === ScrapeStatus.APPROVED
          ? 'This product was already approved.'
          : 'Only products waiting for review can be approved.',
      );
    }

    try {
      const problems: string[] = [];
      if (!doc.name?.trim()) problems.push('a name');
      if (!doc.price || doc.price <= 0) problems.push('a selling price');
      if (!doc.categoryId) problems.push('a category');
      if (!doc.unit?.trim()) problems.push('a unit (e.g. 500 g)');
      if (problems.length) {
        throw new BadRequestException(
          `Add ${problems.join(', ')} before approving.`,
        );
      }
      await this.assertHierarchy(
        idOf(doc.categoryId),
        idOf(doc.subcategoryId),
        idOf(doc.itemGroupId),
      );

      const product = await this.productsService.create(
        this.toProduct(doc, publishAs),
      );

      doc.status = ScrapeStatus.APPROVED;
      doc.productId = product._id;
      doc.reviewedBy = oid(userId);
      doc.reviewedAt = new Date();
      await doc.save();
      return { item: doc.toObject(), product };
    } catch (error) {
      await this.scrapedModel.updateOne(
        { _id: doc._id, status: ScrapeStatus.APPROVING },
        { $set: { status: ScrapeStatus.READY } },
      );
      if ((error as any)?.code === 11000) {
        throw new ConflictException(
          'A product with this barcode already exists. Change or clear the barcode.',
        );
      }
      throw error;
    }
  }

  private toProduct(
    doc: ScrapedProductDocument,
    publishAs: 'active' | 'draft' = 'active',
  ): Partial<Product> {
    const price = doc.price!;
    const mrp = doc.mrp && doc.mrp >= price ? doc.mrp : price;
    const images = doc.images.map((img) => img.url);
    const storage =
      doc.storage === 'Frozen'
        ? StorageType.FROZEN
        : doc.storage === 'Refrigerated'
          ? StorageType.REFRIGERATED
          : StorageType.AMBIENT;
    const dietary = (
      {
        Veg: DietaryType.VEG,
        'Non-Veg': DietaryType.NON_VEG,
        Vegan: DietaryType.VEGAN,
      } as Record<string, DietaryType>
    )[doc.dietary ?? ''];
    const shelfLife = doc.shelfLifeDays ?? 0;

    return {
      name: doc.name!.trim(),
      brand: doc.brand || undefined,
      barcode: doc.barcode || undefined,
      categoryId: doc.categoryId as any,
      subcategoryId: doc.subcategoryId as any,
      itemGroupId: doc.itemGroupId as any,
      price,
      originalPrice: mrp,
      pricing: { mrp, sellingPrice: price, gst: 0 },
      unit: doc.unit!.trim(),
      pack: { unit: doc.unit!.trim() },
      stock: doc.stock ?? 0,
      images,
      image: images[0],
      imageProcessed: images.length > 0,
      description: doc.description,
      highlights: doc.highlights,
      shelfLife,
      isPerishable:
        storage !== StorageType.AMBIENT || (shelfLife > 0 && shelfLife <= 7),
      attributes: {
        storage,
        dietary: dietary ? [dietary] : [],
      } as any,
      ...(doc.nutrition ? { nutrition: doc.nutrition as any } : {}),
      status:
        publishAs === 'draft' ? ProductStatus.DRAFT : ProductStatus.ACTIVE,
      isAvailable: true,
    };
  }

  async decline(id: string, reason: string | undefined, userId?: string) {
    const doc = await this.scrapedModel.findOneAndUpdate(
      { _id: id, status: { $in: [ScrapeStatus.READY, ScrapeStatus.FAILED] } },
      {
        $set: {
          status: ScrapeStatus.DECLINED,
          declineReason: reason?.trim() || undefined,
          reviewedBy: oid(userId),
          reviewedAt: new Date(),
        },
      },
      { new: false },
    );
    if (!doc) {
      await this.mustFind(id);
      throw new ConflictException(
        'Only products waiting for review or failed links can be declined.',
      );
    }
    // Declined products keep their text for the record but not their images.
    await this.storage.deleteMany(
      doc.images.map((img) => img.key!).filter(Boolean),
    );
    const updated = await this.scrapedModel.findByIdAndUpdate(
      id,
      { $set: { images: [] } },
      { new: true },
    );
    return { item: updated?.toObject() };
  }

  async bulkApprove(
    ids: string[],
    publishAs?: 'active' | 'draft',
    userId?: string,
  ) {
    const results: BulkResult[] = [];
    for (const id of ids) {
      try {
        const { product } = await this.approve(id, { publishAs }, userId);
        results.push({ id, ok: true, productId: String(product._id) });
      } catch (error) {
        results.push({ id, ok: false, message: (error as Error).message });
      }
    }
    return { results, approved: results.filter((r) => r.ok).length };
  }

  async bulkDecline(ids: string[], reason?: string, userId?: string) {
    const results: BulkResult[] = [];
    for (const id of ids) {
      try {
        await this.decline(id, reason, userId);
        results.push({ id, ok: true });
      } catch (error) {
        results.push({ id, ok: false, message: (error as Error).message });
      }
    }
    return { results, declined: results.filter((r) => r.ok).length };
  }

  /** Subcategory must sit under the category, item group under the subcategory. */
  private async assertHierarchy(
    categoryId?: string,
    subcategoryId?: string,
    itemGroupId?: string,
  ) {
    if ((subcategoryId || itemGroupId) && !categoryId) {
      throw new BadRequestException('Pick a category first.');
    }
    if (itemGroupId && !subcategoryId) {
      throw new BadRequestException('Pick a subcategory for this item group.');
    }
    if (categoryId && !(await this.categoryModel.exists({ _id: categoryId }))) {
      throw new BadRequestException('That category no longer exists.');
    }
    if (subcategoryId) {
      const sub = await this.subcategoryModel
        .findById(subcategoryId)
        .select('parentId')
        .lean();
      if (!sub || String(sub.parentId) !== categoryId) {
        throw new BadRequestException(
          'That subcategory is not in the selected category.',
        );
      }
    }
    if (itemGroupId) {
      const group = await this.itemGroupModel
        .findById(itemGroupId)
        .select('subcategoryId')
        .lean();
      if (!group || String(group.subcategoryId) !== subcategoryId) {
        throw new BadRequestException(
          'That item group is not in the selected subcategory.',
        );
      }
    }
  }
}
