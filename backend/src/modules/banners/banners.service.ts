import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Banner,
  BannerDocument,
  BannerTargetType,
} from './schemas/banner.schema';
import {
  BannerTargetDto,
  CreateBannerDto,
  UpdateBannerDto,
} from './dto/banner.dto';
import { RedisService } from '../../common/utils/redis.service';

/** Short TTL: a banner's time window must take effect within a minute. */
export const PUBLIC_BANNERS_CACHE_KEY = 'c:banners:active';
const PUBLIC_BANNERS_TTL_SECONDS = 60;

@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);

  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
    private readonly redisService: RedisService,
  ) {}

  /** Mongo filter for banners visible at `now`. */
  static activeFilter(now: Date) {
    return {
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      ],
    };
  }

  static toPublic(banner: any) {
    return {
      _id: banner._id?.toString(),
      title: banner.title,
      titleHi: banner.titleHi ?? null,
      image: banner.image,
      target: {
        type: banner.target?.type,
        ...(banner.target?.id ? { id: banner.target.id.toString() } : {}),
        ...(banner.target?.url ? { url: banner.target.url } : {}),
      },
      sortOrder: banner.sortOrder ?? 0,
      startsAt: banner.startsAt ?? null,
      endsAt: banner.endsAt ?? null,
    };
  }

  async findPublic(now: Date = new Date()) {
    try {
      const cached = await this.redisService.getJSON<any[]>(
        PUBLIC_BANNERS_CACHE_KEY,
      );
      if (cached) return cached;
    } catch (error) {
      this.logger.warn(`Banner cache read failed: ${(error as Error).message}`);
    }

    const banners = await this.bannerModel
      .find(BannersService.activeFilter(now))
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(20)
      .lean()
      .exec();
    const result = banners.map((b) => BannersService.toPublic(b));

    try {
      await this.redisService.setJSON(
        PUBLIC_BANNERS_CACHE_KEY,
        result,
        PUBLIC_BANNERS_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(
        `Banner cache write failed: ${(error as Error).message}`,
      );
    }
    return result;
  }

  async adminFindAll() {
    return this.bannerModel
      .find()
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean()
      .exec();
  }

  private toTarget(target: BannerTargetDto) {
    if (target.type === BannerTargetType.URL) {
      return { type: target.type, url: target.url };
    }
    return { type: target.type, id: new Types.ObjectId(target.id) };
  }

  private toDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    return value === null ? null : new Date(value);
  }

  private assertWindow(startsAt?: Date | null, endsAt?: Date | null) {
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private async invalidate() {
    try {
      await this.redisService.del(PUBLIC_BANNERS_CACHE_KEY);
    } catch (error) {
      this.logger.warn(
        `Banner cache invalidation failed: ${(error as Error).message}`,
      );
    }
  }

  async create(dto: CreateBannerDto) {
    const startsAt = this.toDate(dto.startsAt) ?? null;
    const endsAt = this.toDate(dto.endsAt) ?? null;
    this.assertWindow(startsAt, endsAt);

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const last = await this.bannerModel
        .findOne()
        .sort({ sortOrder: -1 })
        .select('sortOrder')
        .lean()
        .exec();
      sortOrder = last ? (last.sortOrder ?? 0) + 1 : 0;
    }

    const banner = await this.bannerModel.create({
      title: dto.title,
      titleHi: dto.titleHi,
      image: dto.image,
      target: this.toTarget(dto.target),
      sortOrder,
      startsAt,
      endsAt,
      isActive: dto.isActive ?? true,
    });
    await this.invalidate();
    return banner.toObject();
  }

  async update(id: string, dto: UpdateBannerDto) {
    const existing = await this.bannerModel.findById(id).lean().exec();
    if (!existing) throw new NotFoundException('Banner not found');

    const $set: Record<string, any> = {};
    for (const key of [
      'title',
      'titleHi',
      'image',
      'sortOrder',
      'isActive',
    ] as const) {
      if (dto[key] !== undefined) $set[key] = dto[key];
    }
    if (dto.target) $set.target = this.toTarget(dto.target);
    const startsAt = this.toDate(dto.startsAt);
    const endsAt = this.toDate(dto.endsAt);
    if (startsAt !== undefined) $set.startsAt = startsAt;
    if (endsAt !== undefined) $set.endsAt = endsAt;
    this.assertWindow(
      startsAt !== undefined ? startsAt : existing.startsAt,
      endsAt !== undefined ? endsAt : existing.endsAt,
    );

    const banner = await this.bannerModel
      .findByIdAndUpdate(id, { $set }, { new: true })
      .lean()
      .exec();
    await this.invalidate();
    return banner;
  }

  async remove(id: string) {
    const deleted = await this.bannerModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Banner not found');
    await this.invalidate();
  }

  /** sortOrder = position in `ids`. Unknown ids are rejected. */
  async reorder(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw new BadRequestException('ids must not contain duplicates');
    }
    const found = await this.bannerModel.countDocuments({
      _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
    });
    if (found !== unique.length) {
      throw new BadRequestException('Some banners do not exist');
    }
    await this.bannerModel.bulkWrite(
      unique.map((id, index) => ({
        updateOne: {
          filter: { _id: new Types.ObjectId(id) },
          update: { $set: { sortOrder: index } },
        },
      })),
    );
    await this.invalidate();
    return this.adminFindAll();
  }
}
