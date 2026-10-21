import { TrackingGateway } from './tracking.gateway';

describe('TrackingGateway.connectedRiderIds', () => {
  const gateway = new TrackingGateway(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  const fetchSockets = jest.fn();
  const inRooms = jest.fn(() => ({ fetchSockets }));
  (gateway as any).server = { in: inRooms };

  it('returns riders with a socket in their rider room', async () => {
    fetchSockets.mockResolvedValue([
      { data: { user: { userId: 'r1', role: 'rider' } } },
      { data: { user: { userId: 'r1', role: 'rider' } } },
      { data: { user: { userId: 'admin', role: 'admin' } } },
      { data: {} },
    ]);
    const ids = await gateway.connectedRiderIds(['r1', 'r2']);
    expect(inRooms).toHaveBeenCalledWith(['rider_r1', 'rider_r2']);
    expect([...ids]).toEqual(['r1']);
  });

  it('asks nothing for an empty list', async () => {
    inRooms.mockClear();
    expect((await gateway.connectedRiderIds([])).size).toBe(0);
    expect(inRooms).not.toHaveBeenCalled();
  });
});
