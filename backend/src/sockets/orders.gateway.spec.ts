jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    subscribe: jest.fn(),
    on: jest.fn(),
  })),
);

import { Types } from 'mongoose';
import { OrdersGateway } from './orders.gateway';

describe('OrdersGateway auth', () => {
  const ownerId = new Types.ObjectId().toString();
  const riderId = new Types.ObjectId().toString();
  const jwtService = { verifyAsync: jest.fn() };
  const configService = { get: jest.fn().mockReturnValue('secret') };
  const ordersService = { findAccessInfoByOrderId: jest.fn() };
  let gateway: OrdersGateway;

  const makeClient = (handshake: any = {}, user?: any) => ({
    id: 'sock-1',
    handshake: { auth: {}, query: {}, headers: {}, ...handshake },
    data: user ? { user } : {},
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new OrdersGateway(
      configService as any,
      jwtService as any,
      ordersService as any,
    );
    ordersService.findAccessInfoByOrderId.mockResolvedValue({
      orderId: 'ORD-1',
      userId: new Types.ObjectId(ownerId),
      riderId: new Types.ObjectId(riderId),
    });
  });

  it('disconnects clients without a token', async () => {
    const client = makeClient();
    await gateway.handleConnection(client as any);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('disconnects clients with an invalid token', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('bad'));
    const client = makeClient({ auth: { token: 'x' } });
    await gateway.handleConnection(client as any);
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('attaches the user for valid tokens', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: ownerId,
      role: 'customer',
    });
    const client = makeClient({ headers: { authorization: 'Bearer tok' } });
    await gateway.handleConnection(client as any);
    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.data.user).toEqual({ userId: ownerId, role: 'customer' });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('tok', {
      secret: 'secret',
    });
  });

  it('lets owner, assigned rider and admin join; rejects others', async () => {
    const cases: [any, boolean][] = [
      [{ userId: ownerId, role: 'customer' }, true],
      [{ userId: riderId, role: 'rider' }, true],
      [{ userId: new Types.ObjectId().toString(), role: 'admin' }, true],
      [{ userId: new Types.ObjectId().toString(), role: 'customer' }, false],
      [{ userId: new Types.ObjectId().toString(), role: 'rider' }, false],
    ];

    for (const [user, allowed] of cases) {
      const client = makeClient({}, user);
      await gateway.handleJoinOrder(client as any, 'ORD-1');
      if (allowed) {
        expect(client.join).toHaveBeenCalledWith('order:ORD-1');
      } else {
        expect(client.join).not.toHaveBeenCalled();
      }
    }
  });

  it('rejects joinOrder from unauthenticated sockets', async () => {
    const client = makeClient();
    await gateway.handleJoinOrder(client as any, 'ORD-1');
    expect(client.join).not.toHaveBeenCalled();
  });
});
