import { BadRequestException } from '@nestjs/common';
import { AnalyticsSummaryService } from './analytics-summary.service';
import { OrderStatus } from '../orders/schemas/order.schema';

describe('AnalyticsSummaryService', () => {
  const count = (value: number) => ({
    exec: jest.fn().mockResolvedValue(value),
  });
  let orderModel: any;
  let productModel: any;
  let userModel: any;
  let service: AnalyticsSummaryService;

  beforeEach(() => {
    orderModel = { aggregate: jest.fn() };
    productModel = { countDocuments: jest.fn() };
    userModel = { countDocuments: jest.fn().mockReturnValue(count(4)) };
    const settings = {
      getStoreSettings: jest
        .fn()
        .mockResolvedValue({ timezone: 'Asia/Kolkata' }),
    };
    service = new AnalyticsSummaryService(
      orderModel,
      productModel,
      userModel,
      settings as any,
    );
  });

  it('resolves inclusive local-day ranges in the store timezone', () => {
    const range = service.resolveRange(
      'Asia/Kolkata',
      '2026-10-01',
      '2026-10-03',
    );
    expect(range.days).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(range.start.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(range.end.toISOString()).toBe('2026-10-03T18:30:00.000Z');
  });

  it('defaults to the last 7 days including today', () => {
    const range = service.resolveRange(
      'Asia/Kolkata',
      undefined,
      undefined,
      new Date('2026-10-12T20:00:00Z'), // 13 Oct 01:30 IST
    );
    expect(range.from).toBe('2026-10-07');
    expect(range.to).toBe('2026-10-13');
    expect(range.days).toHaveLength(7);
  });

  it('rejects reversed or too long ranges', () => {
    expect(() =>
      service.resolveRange('Asia/Kolkata', '2026-10-05', '2026-10-01'),
    ).toThrow(BadRequestException);
    expect(() =>
      service.resolveRange('Asia/Kolkata', '2024-01-01', '2026-01-01'),
    ).toThrow(BadRequestException);
  });

  it('builds the summary from real aggregates only, filling empty days', async () => {
    orderModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          byStatus: [
            { _id: 'PENDING', count: 2 },
            { _id: 'DELIVERED', count: 3 },
            { _id: 'CANCELLED', count: 1 },
          ],
          totals: [{ _id: null, orders: 5, revenue: 1001 }],
          daily: [{ _id: '2026-10-02', orders: 5, revenue: 1001 }],
        },
      ]),
    });
    productModel.countDocuments
      .mockReturnValueOnce(count(120))
      .mockReturnValueOnce(count(7))
      .mockReturnValueOnce(count(9));

    const summary = await service.getSummary('2026-10-01', '2026-10-03');

    expect(summary).toEqual({
      range: { from: '2026-10-01', to: '2026-10-03', timezone: 'Asia/Kolkata' },
      revenue: 1001,
      orders: 5,
      cancelledOrders: 1,
      averageOrderValue: 200.2,
      ordersByStatus: {
        [OrderStatus.PENDING]: 2,
        [OrderStatus.CONFIRMED]: 0,
        [OrderStatus.ASSIGNED]: 0,
        [OrderStatus.PACKED]: 0,
        [OrderStatus.PICKED_UP]: 0,
        [OrderStatus.OUT_FOR_DELIVERY]: 0,
        [OrderStatus.DELIVERED]: 3,
        [OrderStatus.CANCELLED]: 1,
      },
      activeProducts: 120,
      outOfStock: 7,
      lowStock: 9,
      newCustomers: 4,
      timeseries: [
        { date: '2026-10-01', orders: 0, revenue: 0 },
        { date: '2026-10-02', orders: 5, revenue: 1001 },
        { date: '2026-10-03', orders: 0, revenue: 0 },
      ],
    });
    expect(summary).not.toHaveProperty('conversionRate');
  });

  it('reports zero average order value with no orders', async () => {
    orderModel.aggregate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue([{ byStatus: [], totals: [], daily: [] }]),
    });
    productModel.countDocuments.mockReturnValue(count(0));
    const summary = await service.getSummary('2026-10-01', '2026-10-01');
    expect(summary.averageOrderValue).toBe(0);
    expect(summary.revenue).toBe(0);
  });
});
