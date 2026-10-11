import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { CreateBannerDto, ReorderBannersDto } from './dto/banner.dto';
import { BannersService, PUBLIC_BANNERS_CACHE_KEY } from './banners.service';

const errorsFor = async (cls: any, body: Record<string, unknown>) =>
  validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const valid = {
  title: 'Diwali offers',
  image: 'https://cdn.example.com/b.jpg',
  target: { type: 'category', id: new Types.ObjectId().toString() },
};

describe('Banner DTOs', () => {
  it('accepts a category banner and a url banner', async () => {
    expect(await errorsFor(CreateBannerDto, valid)).toHaveLength(0);
    expect(
      await errorsFor(CreateBannerDto, {
        ...valid,
        target: { type: 'url', url: 'https://example.com/sale' },
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: null,
      }),
    ).toHaveLength(0);
  });

  it('requires an https image', async () => {
    const errors = await errorsFor(CreateBannerDto, {
      ...valid,
      image: 'http://cdn.example.com/b.jpg',
    });
    expect(errors.map((e) => e.property)).toEqual(['image']);
  });

  it('requires id for category/product targets and an https url for url targets', async () => {
    expect(
      (
        await errorsFor(CreateBannerDto, {
          ...valid,
          target: { type: 'product' },
        })
      ).length,
    ).toBe(1);
    expect(
      (
        await errorsFor(CreateBannerDto, {
          ...valid,
          target: { type: 'url', url: 'javascript:alert(1)' },
        })
      ).length,
    ).toBe(1);
    expect(
      (await errorsFor(CreateBannerDto, { ...valid, target: { type: 'nope' } }))
        .length,
    ).toBe(1);
  });

  it('reorder takes a list of ids', async () => {
    expect(
      await errorsFor(ReorderBannersDto, {
        ids: [new Types.ObjectId().toString()],
      }),
    ).toHaveLength(0);
    expect((await errorsFor(ReorderBannersDto, { ids: ['x'] })).length).toBe(1);
  });
});

describe('BannersService', () => {
  const redis = {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    del: jest.fn(),
  };
  const exec = (value: any) => ({
    sort: () => ({
      limit: () => ({ lean: () => ({ exec: () => Promise.resolve(value) }) }),
    }),
  });

  beforeEach(() => jest.clearAllMocks());

  it('public filter only matches active banners inside their window', () => {
    const now = new Date('2026-10-12T10:00:00Z');
    expect(BannersService.activeFilter(now)).toEqual({
      isActive: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      ],
    });
  });

  it('serves public banners from a short-lived cache', async () => {
    const id = new Types.ObjectId();
    const model = {
      find: jest.fn(() =>
        exec([
          {
            _id: id,
            title: 'A',
            image: 'https://x/a.jpg',
            target: { type: 'url', url: 'https://x' },
            sortOrder: 0,
          },
        ]),
      ),
    };
    const service = new BannersService(model as any, redis as any);
    redis.getJSON.mockResolvedValueOnce(null);

    const banners = await service.findPublic();
    expect(banners).toEqual([
      expect.objectContaining({
        _id: id.toString(),
        target: { type: 'url', url: 'https://x' },
      }),
    ]);
    expect(redis.setJSON).toHaveBeenCalledWith(
      PUBLIC_BANNERS_CACHE_KEY,
      banners,
      60,
    );

    redis.getJSON.mockResolvedValueOnce(banners);
    await service.findPublic();
    expect(model.find).toHaveBeenCalledTimes(1);
  });

  it('rejects an end before the start', async () => {
    const service = new BannersService({} as any, redis as any);
    await expect(
      service.create({
        ...valid,
        target: valid.target as any,
        sortOrder: 0,
        startsAt: '2026-10-12T00:00:00Z',
        endsAt: '2026-10-11T00:00:00Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('reorder writes sortOrder by position and invalidates the cache', async () => {
    const ids = [new Types.ObjectId(), new Types.ObjectId()].map(String);
    const model = {
      countDocuments: jest.fn().mockResolvedValue(2),
      bulkWrite: jest.fn(),
      find: jest.fn(() => ({
        sort: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
      })),
    };
    const service = new BannersService(model as any, redis as any);
    await service.reorder(ids);

    const ops = model.bulkWrite.mock.calls[0][0];
    expect(ops.map((op: any) => op.updateOne.update.$set.sortOrder)).toEqual([
      0, 1,
    ]);
    expect(redis.del).toHaveBeenCalledWith(PUBLIC_BANNERS_CACHE_KEY);

    model.countDocuments.mockResolvedValue(1);
    await expect(service.reorder(ids)).rejects.toThrow('do not exist');
    await expect(service.reorder([ids[0], ids[0]])).rejects.toThrow(
      'duplicates',
    );
  });
});
