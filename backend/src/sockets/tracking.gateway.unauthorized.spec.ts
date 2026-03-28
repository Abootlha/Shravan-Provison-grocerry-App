import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { TrackingGateway } from './tracking.gateway';
import { OrdersService } from '../modules/orders/orders.service';
import { RidersService } from '../modules/riders/riders.service';
import { getModelToken } from '@nestjs/mongoose';
import { Order, OrderStatus } from '../modules/orders/schemas/order.schema';
import { WsException } from '@nestjs/websockets';
import { Types } from 'mongoose';
import { WsJwtGuard } from '../modules/auth/guards/ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';

describe('TrackingGateway - Unauthorized Access Logging (Property 38)', () => {
  let gateway: TrackingGateway;
  let ordersService: OrdersService;
  let loggerSpy: jest.SpyInstance;

  const mockOrderModel = {
    find: jest.fn(),
  };

  const mockOrdersService = {
    findById: jest.fn(),
  };

  const mockRidersService = {
    updateLocation: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingGateway,
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: RidersService,
          useValue: mockRidersService,
        },
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        WsJwtGuard,
      ],
    }).compile();

    gateway = module.get<TrackingGateway>(TrackingGateway);
    ordersService = module.get<OrdersService>(OrdersService);

    // Spy on logger
    loggerSpy = jest.spyOn(gateway['logger'], 'warn');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to generate valid MongoDB ObjectId hex strings
  const objectIdArb = fc.string().map(() => new Types.ObjectId().toString());

  /**
   * Property 38: Unauthorized Room Access Logging
   * 
   * For any unauthorized room join attempt, the system must reject the request and log 
   * an entry containing the user ID, requested room, and timestamp.
   * 
   * Validates: Requirements 11.6
   */
  describe('Property 38: Unauthorized Room Access Logging', () => {
    it('should log unauthorized access attempts with userId, resource, and timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // orderId (MongoDB ObjectId format)
          objectIdArb, // userId
          objectIdArb, // orderOwnerId (different from userId)
          fc.constantFrom('customer', 'rider', 'user'),
          async (orderId, userId, orderOwnerId, userRole) => {
            // Ensure userId is different from orderOwnerId
            fc.pre(userId !== orderOwnerId);

            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(orderOwnerId),
              riderId: null, // No rider assigned
              orderStatus: OrderStatus.PENDING,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const mockClient = {
              id: 'socket-123',
              data: {
                user: {
                  userId,
                  role: userRole,
                },
              },
              join: jest.fn(),
              emit: jest.fn(),
            };

            // Attempt to join order room (should fail because user doesn't own the order)
            try {
              await gateway.handleJoinOrderRoom(mockClient as any, { orderId });
              // Should throw, so fail if we reach here
              expect(true).toBe(false);
            } catch (error) {
              expect(error).toBeInstanceOf(WsException);
              expect((error as WsException).message).toContain('Unauthorized');

              // Verify logging occurred
              expect(loggerSpy).toHaveBeenCalled();
              
              const logCall = loggerSpy.mock.calls[0][0];
              
              // Verify log contains required fields
              expect(logCall).toHaveProperty('message');
              expect(logCall.message).toContain('Unauthorized room access attempt');
              
              expect(logCall).toHaveProperty('userId');
              expect(logCall.userId).toBe(userId);
              
              expect(logCall).toHaveProperty('resource');
              expect(logCall.resource).toContain(orderId);
              
              expect(logCall).toHaveProperty('timestamp');
              expect(new Date(logCall.timestamp).getTime()).toBeGreaterThan(0);
              
              expect(logCall).toHaveProperty('socketId');
              expect(logCall.socketId).toBe('socket-123');
            }

            loggerSpy.mockClear();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should log when rider attempts to join unassigned order', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // orderId
          objectIdArb, // riderId
          objectIdArb, // orderOwnerId
          async (orderId, riderId, orderOwnerId) => {
            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(orderOwnerId),
              riderId: null, // No rider assigned
              orderStatus: OrderStatus.CONFIRMED,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const mockClient = {
              id: 'socket-rider-123',
              data: {
                user: {
                  userId: riderId,
                  role: 'rider',
                },
              },
              join: jest.fn(),
              emit: jest.fn(),
            };

            try {
              await gateway.handleJoinOrderRoom(mockClient as any, { orderId });
              expect(true).toBe(false);
            } catch (error) {
              expect(error).toBeInstanceOf(WsException);

              // Verify logging
              expect(loggerSpy).toHaveBeenCalled();
              const logCall = loggerSpy.mock.calls[0][0];
              
              expect(logCall.userId).toBe(riderId);
              expect(logCall.resource).toContain(orderId);
              expect(logCall.timestamp).toBeDefined();
            }

            loggerSpy.mockClear();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should log when rider attempts to join order assigned to different rider', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // orderId
          objectIdArb, // attemptingRiderId
          objectIdArb, // assignedRiderId
          objectIdArb, // orderOwnerId
          async (orderId, attemptingRiderId, assignedRiderId, orderOwnerId) => {
            // Ensure riders are different
            fc.pre(attemptingRiderId !== assignedRiderId);

            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(orderOwnerId),
              riderId: new Types.ObjectId(assignedRiderId), // Assigned to different rider
              orderStatus: OrderStatus.ASSIGNED,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const mockClient = {
              id: 'socket-rider-456',
              data: {
                user: {
                  userId: attemptingRiderId,
                  role: 'rider',
                },
              },
              join: jest.fn(),
              emit: jest.fn(),
            };

            try {
              await gateway.handleJoinOrderRoom(mockClient as any, { orderId });
              expect(true).toBe(false);
            } catch (error) {
              expect(error).toBeInstanceOf(WsException);

              // Verify logging
              expect(loggerSpy).toHaveBeenCalled();
              const logCall = loggerSpy.mock.calls[0][0];
              
              expect(logCall.userId).toBe(attemptingRiderId);
              expect(logCall.userRole).toBe('rider');
              expect(logCall.resource).toContain(orderId);
              expect(logCall.timestamp).toBeDefined();
            }

            loggerSpy.mockClear();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should NOT log when authorized user joins order room', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // orderId
          objectIdArb, // userId (owner)
          async (orderId, userId) => {
            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId), // User owns the order
              riderId: null,
              orderStatus: OrderStatus.CONFIRMED,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const mockClient = {
              id: 'socket-authorized',
              data: {
                user: {
                  userId,
                  role: 'customer',
                },
              },
              join: jest.fn(),
              emit: jest.fn(),
            };

            await gateway.handleJoinOrderRoom(mockClient as any, { orderId });

            // Verify NO unauthorized access logging occurred
            expect(loggerSpy).not.toHaveBeenCalled();

            loggerSpy.mockClear();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should NOT log when admin joins any order room', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // orderId
          objectIdArb, // adminId
          objectIdArb, // orderOwnerId (different from admin)
          async (orderId, adminId, orderOwnerId) => {
            fc.pre(adminId !== orderOwnerId);

            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(orderOwnerId),
              riderId: null,
              orderStatus: OrderStatus.PACKED,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const mockClient = {
              id: 'socket-admin',
              data: {
                user: {
                  userId: adminId,
                  role: 'admin',
                },
              },
              join: jest.fn(),
              emit: jest.fn(),
            };

            await gateway.handleJoinOrderRoom(mockClient as any, { orderId });

            // Verify NO unauthorized access logging occurred (admin has access)
            expect(loggerSpy).not.toHaveBeenCalled();

            loggerSpy.mockClear();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should NOT log when assigned rider joins order room', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectIdArb, // orderId
          objectIdArb, // riderId
          objectIdArb, // orderOwnerId
          async (orderId, riderId, orderOwnerId) => {
            const mockOrder = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(orderOwnerId),
              riderId: new Types.ObjectId(riderId), // Rider is assigned
              orderStatus: OrderStatus.OUT_FOR_DELIVERY,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const mockClient = {
              id: 'socket-rider-assigned',
              data: {
                user: {
                  userId: riderId,
                  role: 'rider',
                },
              },
              join: jest.fn(),
              emit: jest.fn(),
            };

            await gateway.handleJoinOrderRoom(mockClient as any, { orderId });

            // Verify NO unauthorized access logging occurred (rider is assigned)
            expect(loggerSpy).not.toHaveBeenCalled();

            loggerSpy.mockClear();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
