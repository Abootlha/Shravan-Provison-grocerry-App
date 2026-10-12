import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminCustomersService } from './admin-customers.service';

describe('AdminCustomersService', () => {
  let userModel: any;
  let orderModel: any;
  let service: AdminCustomersService;

  beforeEach(() => {
    userModel = {
      aggregate: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };
    orderModel = { find: jest.fn() };
    service = new AdminCustomersService(userModel, orderModel);
  });

  const stageNames = (pipeline: any[]) =>
    pipeline.map((stage) => Object.keys(stage)[0]);

  it('searches customers only, by escaped name/phone/email', () => {
    expect(service.buildMatch('98+')).toEqual({
      role: 'customer',
      $or: [
        { name: { $regex: '98\\+', $options: 'i' } },
        { phone: { $regex: '98\\+', $options: 'i' } },
        { email: { $regex: '98\\+', $options: 'i' } },
      ],
    });
  });

  it('paginates users before looking up order stats for the default sort', async () => {
    const result = await service.list({ page: 2, limit: 10 } as any);
    const pipeline = userModel.aggregate.mock.calls[0][0];
    expect(stageNames(pipeline)).toEqual([
      '$match',
      '$sort',
      '$skip',
      '$limit',
      '$lookup',
      '$addFields',
      '$project',
    ]);
    expect(pipeline[2]).toEqual({ $skip: 10 });
    expect(result).toEqual({
      customers: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    });
  });

  it('computes stats before sorting by total spent', async () => {
    await service.list({ page: 1, limit: 20, sort: '-totalSpent' } as any);
    const pipeline = userModel.aggregate.mock.calls[0][0];
    expect(stageNames(pipeline).slice(0, 5)).toEqual([
      '$match',
      '$lookup',
      '$addFields',
      '$project',
      '$sort',
    ]);
    expect(pipeline[4]).toEqual({ $sort: { totalSpent: -1, _id: 1 } });
    // Password hashes and refresh tokens are never returned.
    expect(pipeline[3].$project).toMatchObject({
      password: 0,
      refreshToken: 0,
    });
  });

  it('404s for unknown customers', async () => {
    await expect(service.get(new Types.ObjectId().toString())).rejects.toThrow(
      NotFoundException,
    );
  });
});
