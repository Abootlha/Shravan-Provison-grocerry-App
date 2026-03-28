import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import * as fc from 'fast-check';
import { TrackingGateway } from './tracking.gateway';
import { OrdersService } from '../modules/orders/orders.service';
import { RidersService } from '../modules/riders/riders.service';
import { WsJwtGuard } from '../modules/auth/guards/ws-jwt.guard';
import { Order, OrderStatus } from '../modules/orders/schemas/order.schema';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

describe('TrackingGateway', () => {
  let gateway: TrackingGateway;
  let jwtService: JwtService;
  let ordersService: OrdersService;
  let ridersService: RidersService;
  let wsJwtGuard: WsJwtGuard;

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
    verifyAsync: jest.fn(),
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
      ],
    }).compile();

    gateway = module.get<TrackingGateway>(TrackingGateway);
    jwtService = module.get<JwtService>(JwtService);
    ordersService = module.get<OrdersService>(OrdersService);
    ridersService = module.get<RidersService>(RidersService);
    wsJwtGuard = new WsJwtGuard(jwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 15: Socket Authentication', () => {
    /**
     * **Validates: Requirements 5.1, 5.2, 9.6**
     * 
     * For any socket connection attempt, the system must authenticate the JWT token
     * and reject the connection if authentication fails.
     */
    it('should authenticate valid JWT tokens and reject invalid ones', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            token: fc.oneof(
              fc.string({ minLength: 20, maxLength: 200 }), // Valid-looking token
              fc.constant(null), // No token
              fc.constant(''), // Empty token
              fc.constant('invalid-token'), // Invalid token
            ),
            userId: fc.uuid(),
            role: fc.constantFrom('user', 'admin', 'rider'),
            isValidToken: fc.boolean(),
          }),
          async ({ token, userId, role, isValidToken }) => {
            // Determine if this should be a valid authentication
            const hasValidToken = Boolean(token && token.length > 10);
            const shouldSucceed = isValidToken && hasValidToken;

            // Create mock socket
            const mockSocket = {
              id: fc.sample(fc.uuid(), 1)[0],
              handshake: {
                auth: token ? { token } : {},
                query: {},
                headers: {},
              },
              data: {},
            } as unknown as Socket;

            // Create mock execution context
            const mockContext = {
              switchToWs: () => ({
                getClient: () => mockSocket,
              }),
            } as any;

            // Configure JWT service mock
            if (shouldSucceed) {
              mockJwtService.verifyAsync.mockResolvedValue({
                sub: userId,
                role: role,
              });
            } else {
              mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
            }

            // Test authentication
            try {
              const result = await wsJwtGuard.canActivate(mockContext);

              // If we get here, authentication succeeded
              expect(result).toBe(true);
              expect(shouldSucceed).toBe(true);
              expect(mockSocket.data.user).toEqual({
                userId,
                role,
              });
            } catch (error) {
              // Authentication failed
              expect(error).toBeInstanceOf(WsException);
              expect(shouldSucceed).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should extract token from different sources (auth, query, headers)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            token: fc.string({ minLength: 20, maxLength: 200 }),
            userId: fc.uuid(),
            role: fc.constantFrom('user', 'admin', 'rider'),
            tokenLocation: fc.constantFrom('auth', 'query', 'headers'),
          }),
          async ({ token, userId, role, tokenLocation }) => {
            // Create mock socket with token in different locations
            const mockSocket = {
              id: fc.sample(fc.uuid(), 1)[0],
              handshake: {
                auth: tokenLocation === 'auth' ? { token } : {},
                query: tokenLocation === 'query' ? { token } : {},
                headers:
                  tokenLocation === 'headers' ? { authorization: `Bearer ${token}` } : {},
              },
              data: {},
            } as unknown as Socket;

            const mockContext = {
              switchToWs: () => ({
                getClient: () => mockSocket,
              }),
            } as any;

            // Configure JWT service to accept the token
            mockJwtService.verifyAsync.mockResolvedValue({
              sub: userId,
              role: role,
            });

            // Test authentication
            const result = await wsJwtGuard.canActivate(mockContext);

            expect(result).toBe(true);
            expect(mockSocket.data.user).toEqual({
              userId,
              role,
            });
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property 16: Room Naming Convention', () => {
    /**
     * **Validates: Requirements 5.3**
     * 
     * For any socket room created for users, riders, or orders, the room name must
     * follow the format "user_{userId}", "rider_{riderId}", or "order_{orderId}" respectively.
     */
    it('should generate room names in correct format for all entity types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entityType: fc.constantFrom('user', 'rider', 'order'),
            entityId: fc.oneof(
              fc.uuid(),
              fc.string({ minLength: 24, maxLength: 24 }), // MongoDB ObjectId format
              fc.string({ minLength: 10, maxLength: 50 }),
            ),
          }),
          async ({ entityType, entityId }) => {
            // Access private methods via reflection for testing
            const getOrderRoomName = (gateway as any).getOrderRoomName.bind(gateway);
            const getUserRoomName = (gateway as any).getUserRoomName.bind(gateway);
            const getRiderRoomName = (gateway as any).getRiderRoomName.bind(gateway);

            let roomName: string;
            let expectedPrefix: string;

            switch (entityType) {
              case 'user':
                roomName = getUserRoomName(entityId);
                expectedPrefix = 'user_';
                break;
              case 'rider':
                roomName = getRiderRoomName(entityId);
                expectedPrefix = 'rider_';
                break;
              case 'order':
                roomName = getOrderRoomName(entityId);
                expectedPrefix = 'order_';
                break;
            }

            // Verify room name format
            expect(roomName).toBe(`${expectedPrefix}${entityId}`);
            expect(roomName.startsWith(expectedPrefix)).toBe(true);
            expect(roomName.length).toBeGreaterThan(expectedPrefix.length);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 17: Order Room Authorization', () => {
    /**
     * **Validates: Requirements 5.4, 9.7**
     * 
     * For any user attempting to join an order room, the system must allow access
     * if and only if the user's ID matches the order's userId or the user has admin role.
     */
    it('should authorize order room access for owners and admins only', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }),
            orderUserId: fc.string({ minLength: 24, maxLength: 24 }),
            requestingUserId: fc.string({ minLength: 24, maxLength: 24 }),
            requestingUserRole: fc.constantFrom('user', 'admin', 'rider'),
            orderHasRider: fc.boolean(),
            orderRiderId: fc.string({ minLength: 24, maxLength: 24 }),
          }),
          async ({
            orderId,
            orderUserId,
            requestingUserId,
            requestingUserRole,
            orderHasRider,
            orderRiderId,
          }) => {
            // Create mock order
            const mockOrder = {
              _id: orderId,
              userId: { toString: () => orderUserId },
              riderId: orderHasRider ? { toString: () => orderRiderId } : null,
              orderStatus: 'ASSIGNED',
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            // Create mock socket
            const mockSocket = {
              id: fc.sample(fc.uuid(), 1)[0],
              data: {
                user: {
                  userId: requestingUserId,
                  role: requestingUserRole,
                },
              },
              join: jest.fn(),
              emit: jest.fn(),
            } as unknown as Socket;

            // Determine if access should be granted
            const isOwner = requestingUserId === orderUserId;
            const isAdmin = requestingUserRole === 'admin';
            const isAssignedRider = orderHasRider && requestingUserId === orderRiderId;
            const shouldBeAuthorized = isOwner || isAdmin || isAssignedRider;

            try {
              await gateway.handleJoinOrderRoom(mockSocket, { orderId });

              // If we get here, access was granted
              expect(shouldBeAuthorized).toBe(true);
              expect(mockSocket.join).toHaveBeenCalledWith(`order_${orderId}`);
              expect(mockSocket.emit).toHaveBeenCalledWith('joinedOrderRoom', {
                orderId,
                roomName: `order_${orderId}`,
              });
            } catch (error) {
              // Access was denied
              expect(error).toBeInstanceOf(WsException);
              expect(shouldBeAuthorized).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 18: Rider Room Authorization', () => {
    /**
     * **Validates: Requirements 5.5, 9.7**
     * 
     * For any rider attempting to join an order room, the system must allow access
     * if and only if the rider's ID matches the order's riderId.
     */
    it('should authorize order room access for assigned riders only', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }),
            orderUserId: fc.string({ minLength: 24, maxLength: 24 }),
            orderRiderId: fc.string({ minLength: 24, maxLength: 24 }),
            requestingRiderId: fc.string({ minLength: 24, maxLength: 24 }),
            orderHasRider: fc.boolean(),
          }),
          async ({ orderId, orderUserId, orderRiderId, requestingRiderId, orderHasRider }) => {
            // Create mock order
            const mockOrder = {
              _id: orderId,
              userId: { toString: () => orderUserId },
              riderId: orderHasRider ? { toString: () => orderRiderId } : null,
              orderStatus: 'ASSIGNED',
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            // Create mock socket for rider
            const mockSocket = {
              id: fc.sample(fc.uuid(), 1)[0],
              data: {
                user: {
                  userId: requestingRiderId,
                  role: 'rider',
                },
              },
              join: jest.fn(),
              emit: jest.fn(),
            } as unknown as Socket;

            // Determine if access should be granted
            const isAssignedRider = orderHasRider && requestingRiderId === orderRiderId;
            const shouldBeAuthorized = isAssignedRider;

            try {
              await gateway.handleJoinOrderRoom(mockSocket, { orderId });

              // If we get here, access was granted
              expect(shouldBeAuthorized).toBe(true);
              expect(mockSocket.join).toHaveBeenCalledWith(`order_${orderId}`);
            } catch (error) {
              // Access was denied
              expect(error).toBeInstanceOf(WsException);
              expect(shouldBeAuthorized).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
