import { RidersService } from './riders.service';
import { RiderStatus } from './schemas/rider.schema';

describe('RidersService.updatePresence', () => {
  const riderModel = { findById: jest.fn() };
  const orderModel = { exists: jest.fn() };
  const service = new RidersService(
    riderModel as any,
    orderModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const rider = (status: RiderStatus) => ({
    _id: 'r1',
    status,
    lastActiveAt: undefined as Date | undefined,
    save: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    orderModel.exists.mockResolvedValue(null);
  });

  it('going online with only { isOnline: true } makes the rider available', async () => {
    const doc = rider(RiderStatus.OFFLINE);
    riderModel.findById.mockResolvedValue(doc);
    await service.updatePresence('r1', { isOnline: true });
    expect(doc.status).toBe(RiderStatus.AVAILABLE);
    expect(doc.lastActiveAt).toBeInstanceOf(Date);
    expect(doc.save).toHaveBeenCalled();
  });

  it('an explicit isAvailable: false keeps an online rider busy', async () => {
    const doc = rider(RiderStatus.OFFLINE);
    riderModel.findById.mockResolvedValue(doc);
    await service.updatePresence('r1', { isOnline: true, isAvailable: false });
    expect(doc.status).toBe(RiderStatus.BUSY);
  });

  it('going online while carrying an order keeps the rider busy', async () => {
    const doc = rider(RiderStatus.OFFLINE);
    riderModel.findById.mockResolvedValue(doc);
    orderModel.exists.mockResolvedValue({ _id: 'o1' });
    await service.updatePresence('r1', { isOnline: true });
    expect(doc.status).toBe(RiderStatus.BUSY);
  });

  it('going offline makes the rider offline', async () => {
    const doc = rider(RiderStatus.AVAILABLE);
    riderModel.findById.mockResolvedValue(doc);
    await service.updatePresence('r1', { isOnline: false });
    expect(doc.status).toBe(RiderStatus.OFFLINE);
  });
});
