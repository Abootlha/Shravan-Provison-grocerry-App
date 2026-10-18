import { Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RidersService, periodStarts } from './riders.service';
import { OrderStatus } from '../orders/schemas/order.schema';
import { VehicleType } from './schemas/rider.schema';
import { UpdateRiderProfileDto, RiderLocationDto } from './dto/rider-self.dto';

describe('periodStarts (Asia/Kolkata)', () => {
  it('returns local midnight, Monday and the 1st as UTC instants', () => {
    // Wed 15 Oct 2026, 02:00 IST = Tue 14 Oct 20:30 UTC.
    const now = new Date('2026-10-14T20:30:00Z');
    const { dayStart, weekStart, monthStart } = periodStarts(
      now,
      'Asia/Kolkata',
    );
    expect(dayStart.toISOString()).toBe('2026-10-14T18:30:00.000Z');
    expect(weekStart.toISOString()).toBe('2026-10-11T18:30:00.000Z'); // Mon 12 Oct IST
    expect(monthStart.toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });

  it('handles weeks that start in the previous month', () => {
    // Fri 2 Oct 2026, 10:00 IST: the week started Mon 28 Sep.
    const now = new Date('2026-10-02T04:30:00Z');
    const { weekStart, monthStart } = periodStarts(now, 'Asia/Kolkata');
    expect(weekStart.toISOString()).toBe('2026-09-27T18:30:00.000Z');
    expect(monthStart.getTime()).toBeGreaterThan(weekStart.getTime());
  });
});

describe('RidersService.getMetrics', () => {
  const riderId = new Types.ObjectId().toString();
  const riderModel = { findById: jest.fn() };
  const orderModel = { countDocuments: jest.fn(), aggregate: jest.fn() };
  const statusLogModel = { countDocuments: jest.fn() };
  const service = new RidersService(
    riderModel as any,
    orderModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    statusLogModel as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    riderModel.findById.mockResolvedValue({ _id: riderId, rating: 4.5 });
  });

  it('returns real per-period deliveries and deliveryFee+tip earnings', async () => {
    orderModel.countDocuments.mockResolvedValue(42);
    orderModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          todayCount: 3,
          todayEarnings: 75,
          weekCount: 10,
          weekEarnings: 260.5,
          monthCount: 30,
          monthEarnings: 790.125,
        },
      ]),
    });
    statusLogModel.countDocuments
      .mockResolvedValueOnce(9) // accepted
      .mockResolvedValueOnce(1); // rejected

    const now = new Date('2026-10-14T20:30:00Z');
    const metrics = await service.getMetrics(riderId, now);

    expect(metrics).toEqual({
      totalDeliveries: 42,
      avgRating: 4.5,
      acceptanceRate: 90,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      earningsBasis: 'deliveryFee+tip',
      today: { deliveries: 3, earnings: 75 },
      week: { deliveries: 10, earnings: 260.5 },
      month: { deliveries: 30, earnings: 790.13 },
    });
    expect(metrics).not.toHaveProperty('onlineHours');

    const [pipeline] = orderModel.aggregate.mock.calls[0];
    const match = pipeline[0].$match;
    expect(match.riderId.toString()).toBe(riderId);
    expect(match.orderStatus).toBe(OrderStatus.DELIVERED);
    // Covers whichever of week/month started earlier.
    expect(match.actualDeliveryTime.$gte.toISOString()).toBe(
      '2026-09-30T18:30:00.000Z',
    );
    // Earnings add deliveryFee and tip (missing tip counts as 0).
    expect(JSON.stringify(pipeline[1].$group.todayEarnings)).toContain(
      '"$tip"',
    );
  });

  it('returns zeros and a 100% acceptance rate for a new rider', async () => {
    orderModel.countDocuments.mockResolvedValue(0);
    orderModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    statusLogModel.countDocuments.mockResolvedValue(0);

    const metrics = await service.getMetrics(riderId);
    expect(metrics.today).toEqual({ deliveries: 0, earnings: 0 });
    expect(metrics.week).toEqual({ deliveries: 0, earnings: 0 });
    expect(metrics.month).toEqual({ deliveries: 0, earnings: 0 });
    expect(metrics.acceptanceRate).toBe(100);
  });
});

describe('Rider self-service profile', () => {
  it('updates name, vehicle type and a normalised vehicle number', async () => {
    const rider: any = {
      name: 'Old',
      vehicleType: VehicleType.BICYCLE,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RidersService(
      { findById: jest.fn().mockResolvedValue(rider) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await service.updateProfile('r1', {
      name: '  Ravi Kumar ',
      vehicleType: VehicleType.TWO_WHEELER,
      vehicleNumber: ' up53  ab 1234 ',
    });
    expect(rider).toMatchObject({
      name: 'Ravi Kumar',
      vehicleType: VehicleType.TWO_WHEELER,
      vehicleNumber: 'UP53 AB 1234',
    });

    await service.updateProfile('r1', { vehicleNumber: '' });
    expect(rider.vehicleNumber).toBeUndefined();
  });

  it('validates the profile and location DTOs', async () => {
    const errorsFor = async (cls: any, body: object) =>
      (await validate(plainToInstance(cls, body))).length;

    expect(await errorsFor(UpdateRiderProfileDto, { name: 'Ravi' })).toBe(0);
    expect(
      await errorsFor(UpdateRiderProfileDto, { vehicleType: 'Rocket' }),
    ).toBe(1);
    expect(
      await errorsFor(UpdateRiderProfileDto, { vehicleNumber: 'UP53;DROP' }),
    ).toBe(1);

    expect(
      await errorsFor(RiderLocationDto, { latitude: 0, longitude: 0 }),
    ).toBe(0);
    expect(
      await errorsFor(RiderLocationDto, {
        latitude: 10,
        longitude: 10,
        heading: -1,
        speed: -1,
        accuracy: null,
      }),
    ).toBe(0);
    expect(
      await errorsFor(RiderLocationDto, { latitude: 91, longitude: 0 }),
    ).toBe(1);
  });
});
