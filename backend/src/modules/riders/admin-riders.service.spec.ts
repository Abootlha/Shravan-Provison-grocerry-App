import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AdminRidersService } from './admin-riders.service';
import { RiderStatus } from './schemas/rider.schema';
import { createFakeModel } from '../orders/testing/fake-model';

describe('AdminRidersService', () => {
  let riderModel: any;
  let orderModel: any;
  let revoker: { revokeAll: jest.Mock };
  let service: AdminRidersService;

  beforeEach(() => {
    riderModel = createFakeModel();
    orderModel = createFakeModel();
    orderModel.aggregate = jest.fn().mockResolvedValue([]);
    revoker = { revokeAll: jest.fn() };
    service = new AdminRidersService(riderModel, orderModel, revoker as any);
  });

  it('deactivating a rider sets them offline and ends their sessions', async () => {
    const rider = riderModel.insert({
      name: 'R',
      isActive: true,
      status: RiderStatus.AVAILABLE,
    });
    await service.setActive(rider._id.toString(), false);

    expect(riderModel.get(rider._id)).toMatchObject({
      isActive: false,
      status: RiderStatus.OFFLINE,
    });
    expect(revoker.revokeAll).toHaveBeenCalledWith(
      rider._id.toString(),
      'rider',
    );
  });

  it('refuses to deactivate a rider with an active order', async () => {
    const rider = riderModel.insert({ name: 'R', isActive: true });
    orderModel.insert({ riderId: rider._id, orderStatus: 'PICKED_UP' });

    await expect(
      service.setActive(rider._id.toString(), false),
    ).rejects.toThrow(ConflictException);
    expect(riderModel.get(rider._id).isActive).toBe(true);
    expect(revoker.revokeAll).not.toHaveBeenCalled();
  });

  it('reactivating does not revoke sessions', async () => {
    const rider = riderModel.insert({ name: 'R', isActive: false });
    await service.setActive(rider._id.toString(), true);
    expect(riderModel.get(rider._id).isActive).toBe(true);
    expect(revoker.revokeAll).not.toHaveBeenCalled();
  });

  it('normalises the phone and rejects one used by another rider', async () => {
    const a = riderModel.insert({ name: 'A', phone: '+919999999999' });
    const b = riderModel.insert({ name: 'B', phone: '+918888888888' });

    await expect(
      service.update(b._id.toString(), { phone: '9999999999' }),
    ).rejects.toThrow(ConflictException);

    await service.update(a._id.toString(), {
      phone: '7777777777',
      name: ' Asha ',
    });
    expect(riderModel.get(a._id)).toMatchObject({
      phone: '+917777777777',
      name: 'Asha',
    });
  });

  it('stats combine aggregated counts with the active order list', async () => {
    const rider = riderModel.insert({ name: 'R', isActive: true });
    orderModel.aggregate.mockResolvedValue([
      {
        _id: rider._id,
        deliveredCount: 12,
        cancelledCount: 1,
        activeOrderCount: 1,
        deliveredToday: 2,
        lastDeliveredAt: new Date('2026-10-12T05:00:00Z'),
      },
    ]);
    orderModel.insert({
      riderId: rider._id,
      orderId: 'ORD-1',
      orderStatus: 'ASSIGNED',
    });
    orderModel.insert({
      riderId: new Types.ObjectId(),
      orderId: 'ORD-2',
      orderStatus: 'ASSIGNED',
    });

    const stats = await service.stats(rider._id.toString());
    expect(stats).toMatchObject({
      deliveredCount: 12,
      activeOrderCount: 1,
      deliveredToday: 2,
    });
    expect(stats.activeOrders.map((o: any) => o.orderId)).toEqual(['ORD-1']);
  });
});
