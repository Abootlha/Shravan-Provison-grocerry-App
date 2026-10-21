import { Types } from 'mongoose';
import { EXPO_PUSH_URL, RiderPushService } from './rider-push.service';

describe('RiderPushService', () => {
  const riderId = new Types.ObjectId().toString();
  const lean = jest.fn();
  const riderModel = {
    findById: jest.fn(() => ({
      select: () => ({ lean: () => ({ exec: lean }) }),
    })),
    updateOne: jest.fn(() => ({ exec: jest.fn().mockResolvedValue({}) })),
  };
  const fetchMock = jest.fn();
  const make = (accessToken?: string) =>
    new RiderPushService(
      riderModel as any,
      { get: () => accessToken } as any,
      fetchMock as any,
    );
  const message = {
    title: 'New order request #A1',
    body: '2 items',
    data: { type: 'order_offer', orderId: 'o1' },
    channelId: 'order-alerts',
  };
  const tickets = (data: unknown[]) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) });

  beforeEach(() => jest.clearAllMocks());

  it('sends one high-priority message per device on the given channel', async () => {
    lean.mockResolvedValue({
      pushTokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
    });
    fetchMock.mockReturnValue(tickets([{ status: 'ok' }, { status: 'ok' }]));

    await expect(make('secret').send(riderId, message)).resolves.toBe(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(EXPO_PUSH_URL);
    expect(init.headers.Authorization).toBe('Bearer secret');
    const body = JSON.parse(init.body);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      to: 'ExponentPushToken[a]',
      title: message.title,
      priority: 'high',
      sound: 'default',
      channelId: 'order-alerts',
      data: message.data,
    });
  });

  it('removes tokens Expo reports as no longer registered', async () => {
    lean.mockResolvedValue({
      pushTokens: ['ExponentPushToken[a]', 'ExponentPushToken[gone]'],
    });
    fetchMock.mockReturnValue(
      tickets([
        { status: 'ok' },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
      ]),
    );

    await expect(make().send(riderId, message)).resolves.toBe(1);
    expect(riderModel.updateOne).toHaveBeenCalledWith(
      { _id: riderId },
      { $pull: { pushTokens: { $in: ['ExponentPushToken[gone]'] } } },
    );
  });

  it('does nothing for a rider without devices', async () => {
    lean.mockResolvedValue({ pushTokens: [] });
    await expect(make().send(riderId, message)).resolves.toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('notify never throws, even when Expo is down', async () => {
    lean.mockResolvedValue({ pushTokens: ['ExponentPushToken[a]'] });
    fetchMock.mockReturnValue(Promise.resolve({ ok: false, status: 503 }));
    expect(() => make().notify(riderId, message)).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});
