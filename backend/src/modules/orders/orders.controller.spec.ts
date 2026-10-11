import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as fc from 'fast-check';
import { OrdersController, AdminOrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatus } from './schemas/order.schema';
import { UserRole } from '../users/schemas/user.schema';
import { Types } from 'mongoose';

describe('OrdersController - Property-Based Tests', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    createOrder: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByUser: jest.fn(),
    updateStatus: jest.fn(),
    assignRider: jest.fn(),
    getOrderStatus: jest.fn(),
    getStatusHistory: jest.fn(),
    getTrackingOrderById: jest.fn(),
    findAccessInfoByOrderId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // **Validates: Requirements 1.4, 9.4**
  // Property 3: Rider Authorization for Status Updates
  describe('Property 3: Rider Authorization for Status Updates', () => {
    it('allows rider to update only their assigned orders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            riderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            assignedRiderId: fc
              .string({ minLength: 24, maxLength: 24 })
              .map((s) =>
                s
                  .split('')
                  .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                  .join('')
                  .slice(0, 24),
              ),
            newStatus: fc.constantFrom(...Object.values(OrderStatus)),
          }),
          async ({ orderId, riderId, assignedRiderId, newStatus }) => {
            const mockOrder: any = {
              _id: new Types.ObjectId(orderId),
              riderId: new Types.ObjectId(assignedRiderId),
              userId: new Types.ObjectId(),
              orderStatus: OrderStatus.ASSIGNED,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);
            mockOrdersService.updateStatus.mockResolvedValue(mockOrder);

            const req = {
              user: {
                userId: riderId,
                role: UserRole.RIDER,
              },
            };

            const updateStatusDto = { status: newStatus };

            if (riderId === assignedRiderId) {
              // Rider is assigned to this order - should succeed
              const result = await controller.updateOrderStatus(
                req,
                orderId,
                updateStatusDto,
              );
              expect(result).toBeDefined();
              expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
                orderId,
                newStatus,
                riderId,
                expect.objectContaining({ actorRole: UserRole.RIDER }),
              );
            } else {
              // Rider is NOT assigned to this order - should throw ForbiddenException
              await expect(
                controller.updateOrderStatus(req, orderId, updateStatusDto),
              ).rejects.toThrow(ForbiddenException);
              expect(mockOrdersService.updateStatus).not.toHaveBeenCalled();
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('prevents riders from updating orders without assigned rider', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            riderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            newStatus: fc.constantFrom(...Object.values(OrderStatus)),
          }),
          async ({ orderId, riderId, newStatus }) => {
            const mockOrder: any = {
              _id: new Types.ObjectId(orderId),
              riderId: null, // No rider assigned
              userId: new Types.ObjectId(),
              orderStatus: OrderStatus.PENDING,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const req = {
              user: {
                userId: riderId,
                role: UserRole.RIDER,
              },
            };

            const updateStatusDto = { status: newStatus };

            await expect(
              controller.updateOrderStatus(req, orderId, updateStatusDto),
            ).rejects.toThrow(ForbiddenException);
            expect(mockOrdersService.updateStatus).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('allows admin to update any order regardless of rider assignment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            adminId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            riderId: fc.option(
              fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
                s
                  .split('')
                  .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                  .join('')
                  .slice(0, 24),
              ),
              { nil: null },
            ),
            newStatus: fc.constantFrom(...Object.values(OrderStatus)),
          }),
          async ({ orderId, adminId, riderId, newStatus }) => {
            const mockOrder: any = {
              _id: new Types.ObjectId(orderId),
              riderId: riderId ? new Types.ObjectId(riderId) : null,
              userId: new Types.ObjectId(),
              orderStatus: OrderStatus.PENDING,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);
            mockOrdersService.updateStatus.mockResolvedValue(mockOrder);

            const req = {
              user: {
                userId: adminId,
                role: UserRole.ADMIN,
              },
            };

            const updateStatusDto = { status: newStatus };

            const riderControlled = [
              OrderStatus.ASSIGNED,
              OrderStatus.PICKED_UP,
              OrderStatus.OUT_FOR_DELIVERY,
              OrderStatus.DELIVERED,
            ].includes(newStatus);

            if (riderControlled) {
              await expect(
                controller.updateOrderStatus(req, orderId, updateStatusDto),
              ).rejects.toThrow(ForbiddenException);
              return;
            }

            const result = await controller.updateOrderStatus(
              req,
              orderId,
              updateStatusDto,
            );
            expect(result).toBeDefined();
            expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
              orderId,
              newStatus,
              adminId,
              expect.objectContaining({ actorRole: UserRole.ADMIN }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('prevents customers from updating order status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            customerId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            newStatus: fc.constantFrom(...Object.values(OrderStatus)),
          }),
          async ({ orderId, customerId, newStatus }) => {
            const mockOrder: any = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(customerId),
              orderStatus: OrderStatus.PENDING,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const req = {
              user: {
                userId: customerId,
                role: UserRole.CUSTOMER,
              },
            };

            const updateStatusDto = { status: newStatus };

            await expect(
              controller.updateOrderStatus(req, orderId, updateStatusDto),
            ).rejects.toThrow(ForbiddenException);
            expect(mockOrdersService.updateStatus).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // **Validates: Requirements 9.5**
  // Property 30: Order Ownership Verification
  describe('Property 30: Order Ownership Verification', () => {
    it('allows user to access their own orders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            userId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          async ({ orderId, userId }) => {
            const mockOrder: any = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(userId),
              orderStatus: OrderStatus.PENDING,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);
            const trackingOrder = { ...mockOrder, deliveryOtp: '1234' };
            mockOrdersService.getTrackingOrderById.mockResolvedValue(
              trackingOrder,
            );

            const req = {
              user: {
                userId: userId,
                role: UserRole.CUSTOMER,
              },
            };

            const result = await controller.getOrder(req, orderId);
            expect(result).toBeDefined();
            expect(result.order).toBe(trackingOrder);
            expect(mockOrdersService.findById).toHaveBeenCalledWith(orderId);
            // The owning customer is the only one who gets the delivery OTP
            expect(mockOrdersService.getTrackingOrderById).toHaveBeenCalledWith(
              orderId,
              { includeDeliveryOtp: true },
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('prevents user from accessing other users orders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            ownerId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            requesterId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          async ({ orderId, ownerId, requesterId }) => {
            // Skip if same user
            fc.pre(ownerId !== requesterId);

            const mockOrder: any = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(ownerId),
              orderStatus: OrderStatus.PENDING,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);

            const req = {
              user: {
                userId: requesterId,
                role: UserRole.CUSTOMER,
              },
            };

            await expect(controller.getOrder(req, orderId)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('allows admin to access any order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            ownerId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            adminId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          async ({ orderId, ownerId, adminId }) => {
            const mockOrder: any = {
              _id: new Types.ObjectId(orderId),
              userId: new Types.ObjectId(ownerId),
              orderStatus: OrderStatus.PENDING,
            };

            mockOrdersService.findById.mockResolvedValue(mockOrder);
            const trackingOrder = { ...mockOrder };
            mockOrdersService.getTrackingOrderById.mockResolvedValue(
              trackingOrder,
            );

            const req = {
              user: {
                userId: adminId,
                role: UserRole.ADMIN,
              },
            };

            const result = await controller.getOrder(req, orderId);
            expect(result).toBeDefined();
            expect(result.order).toBe(trackingOrder);
            // Admins never receive the delivery OTP
            expect(mockOrdersService.getTrackingOrderById).toHaveBeenCalledWith(
              orderId,
              { includeDeliveryOtp: false },
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('allows user to access orders by their userId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          async ({ userId }) => {
            const mockOrders: any[] = [
              { _id: new Types.ObjectId(), userId: new Types.ObjectId(userId) },
              { _id: new Types.ObjectId(), userId: new Types.ObjectId(userId) },
            ];

            mockOrdersService.findByUserId.mockResolvedValue(mockOrders);

            const req = {
              user: {
                userId: userId,
                role: UserRole.CUSTOMER,
              },
            };

            const result = await controller.getOrdersByUserId(req, userId);
            expect(result).toBeDefined();
            expect(result.orders).toBe(mockOrders);
            expect(mockOrdersService.findByUserId).toHaveBeenCalledWith(userId);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('prevents user from accessing other users orders by userId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            targetUserId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            requesterId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          async ({ targetUserId, requesterId }) => {
            // Skip if same user
            fc.pre(targetUserId !== requesterId);

            const req = {
              user: {
                userId: requesterId,
                role: UserRole.CUSTOMER,
              },
            };

            await expect(
              controller.getOrdersByUserId(req, targetUserId),
            ).rejects.toThrow(ForbiddenException);
            expect(mockOrdersService.findByUserId).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('allows admin to access orders by any userId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            targetUserId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            adminId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          async ({ targetUserId, adminId }) => {
            const mockOrders: any[] = [
              {
                _id: new Types.ObjectId(),
                userId: new Types.ObjectId(targetUserId),
              },
            ];

            mockOrdersService.findByUserId.mockResolvedValue(mockOrders);

            const req = {
              user: {
                userId: adminId,
                role: UserRole.ADMIN,
              },
            };

            const result = await controller.getOrdersByUserId(
              req,
              targetUserId,
            );
            expect(result).toBeDefined();
            expect(result.orders).toBe(mockOrders);
            expect(mockOrdersService.findByUserId).toHaveBeenCalledWith(
              targetUserId,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('throws NotFoundException when order does not exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
            userId: fc.string({ minLength: 24, maxLength: 24 }).map((s) =>
              s
                .split('')
                .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
                .join('')
                .slice(0, 24),
            ),
          }),
          async ({ orderId, userId }) => {
            mockOrdersService.findById.mockResolvedValue(null);

            const req = {
              user: {
                userId: userId,
                role: UserRole.CUSTOMER,
              },
            };

            await expect(controller.getOrder(req, orderId)).rejects.toThrow(
              NotFoundException,
            );
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // Unit Tests for Error Responses
  // **Validates: Requirements 11.5, 11.7**
  describe('Error Response Handling', () => {
    describe('Invalid Status Transitions', () => {
      it('returns HTTP 400 with descriptive message for invalid transition', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const userId = '507f1f77bcf86cd799439012';

        const mockOrder: any = {
          _id: new Types.ObjectId(orderId),
          userId: new Types.ObjectId(userId),
          orderStatus: OrderStatus.DELIVERED,
        };

        mockOrdersService.findById.mockResolvedValue(mockOrder);
        mockOrdersService.updateStatus.mockRejectedValue(
          new Error('Cannot transition from DELIVERED to PENDING'),
        );

        const req = {
          user: {
            userId: userId,
            role: UserRole.ADMIN,
          },
        };

        const updateStatusDto = { status: OrderStatus.PENDING };

        await expect(
          controller.updateOrderStatus(req, orderId, updateStatusDto),
        ).rejects.toThrow();
      });

      it('returns HTTP 400 when trying to transition from CANCELLED', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const userId = '507f1f77bcf86cd799439012';

        const mockOrder: any = {
          _id: new Types.ObjectId(orderId),
          userId: new Types.ObjectId(userId),
          orderStatus: OrderStatus.CANCELLED,
        };

        mockOrdersService.findById.mockResolvedValue(mockOrder);
        mockOrdersService.updateStatus.mockRejectedValue(
          new Error('Cannot transition from CANCELLED to CONFIRMED'),
        );

        const req = {
          user: {
            userId: userId,
            role: UserRole.ADMIN,
          },
        };

        const updateStatusDto = { status: OrderStatus.CONFIRMED };

        await expect(
          controller.updateOrderStatus(req, orderId, updateStatusDto),
        ).rejects.toThrow();
      });
    });

    describe('Unauthorized Access', () => {
      it('returns HTTP 403 when customer tries to update status', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const userId = '507f1f77bcf86cd799439012';

        const mockOrder: any = {
          _id: new Types.ObjectId(orderId),
          userId: new Types.ObjectId(userId),
          orderStatus: OrderStatus.PENDING,
        };

        mockOrdersService.findById.mockResolvedValue(mockOrder);

        const req = {
          user: {
            userId: userId,
            role: UserRole.CUSTOMER,
          },
        };

        const updateStatusDto = { status: OrderStatus.CONFIRMED };

        await expect(
          controller.updateOrderStatus(req, orderId, updateStatusDto),
        ).rejects.toThrow(ForbiddenException);
      });

      it('returns HTTP 403 when rider tries to update unassigned order', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const riderId = '507f1f77bcf86cd799439012';
        const assignedRiderId = '507f1f77bcf86cd799439013';

        const mockOrder: any = {
          _id: new Types.ObjectId(orderId),
          userId: new Types.ObjectId(),
          riderId: new Types.ObjectId(assignedRiderId),
          orderStatus: OrderStatus.ASSIGNED,
        };

        mockOrdersService.findById.mockResolvedValue(mockOrder);

        const req = {
          user: {
            userId: riderId,
            role: UserRole.RIDER,
          },
        };

        const updateStatusDto = { status: OrderStatus.OUT_FOR_DELIVERY };

        await expect(
          controller.updateOrderStatus(req, orderId, updateStatusDto),
        ).rejects.toThrow(ForbiddenException);
      });

      it('returns HTTP 403 when user tries to access another users order', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const ownerId = '507f1f77bcf86cd799439012';
        const requesterId = '507f1f77bcf86cd799439013';

        const mockOrder: any = {
          _id: new Types.ObjectId(orderId),
          userId: new Types.ObjectId(ownerId),
          orderStatus: OrderStatus.PENDING,
        };

        mockOrdersService.findById.mockResolvedValue(mockOrder);

        const req = {
          user: {
            userId: requesterId,
            role: UserRole.CUSTOMER,
          },
        };

        await expect(controller.getOrder(req, orderId)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('returns HTTP 403 when user tries to access orders by another userId', async () => {
        const targetUserId = '507f1f77bcf86cd799439012';
        const requesterId = '507f1f77bcf86cd799439013';

        const req = {
          user: {
            userId: requesterId,
            role: UserRole.CUSTOMER,
          },
        };

        await expect(
          controller.getOrdersByUserId(req, targetUserId),
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('Not Found Errors', () => {
      it('returns HTTP 404 when order does not exist', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const userId = '507f1f77bcf86cd799439012';

        mockOrdersService.findById.mockResolvedValue(null);

        const req = {
          user: {
            userId: userId,
            role: UserRole.CUSTOMER,
          },
        };

        await expect(controller.getOrder(req, orderId)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('returns HTTP 404 when trying to update non-existent order', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const userId = '507f1f77bcf86cd799439012';

        mockOrdersService.findById.mockResolvedValue(null);

        const req = {
          user: {
            userId: userId,
            role: UserRole.ADMIN,
          },
        };

        const updateStatusDto = { status: OrderStatus.CONFIRMED };

        await expect(
          controller.updateOrderStatus(req, orderId, updateStatusDto),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('Rider Assignment Errors', () => {
      it('propagates service errors when rider is not available', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const riderId = '507f1f77bcf86cd799439012';

        mockOrdersService.assignRider.mockRejectedValue(
          new Error('Rider is not available or offline'),
        );

        const assignRiderDto = { riderId };

        await expect(
          controller.assignRider(orderId, assignRiderDto),
        ).rejects.toThrow();
      });

      it('propagates service errors when rider does not exist', async () => {
        const orderId = '507f1f77bcf86cd799439011';
        const riderId = '507f1f77bcf86cd799439012';

        mockOrdersService.assignRider.mockRejectedValue(
          new NotFoundException('Rider not found'),
        );

        const assignRiderDto = { riderId };

        await expect(
          controller.assignRider(orderId, assignRiderDto),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });
  describe('Order status/history access control', () => {
    const ownerId = new Types.ObjectId().toString();
    const riderId = new Types.ObjectId().toString();
    const accessInfo = () => ({
      _id: new Types.ObjectId(),
      orderId: 'ORD-20260101-ABCDEF12',
      userId: new Types.ObjectId(ownerId),
      riderId: new Types.ObjectId(riderId),
      orderStatus: OrderStatus.ASSIGNED,
    });
    const history = [
      {
        previousStatus: OrderStatus.PENDING,
        newStatus: OrderStatus.CONFIRMED,
        changedBy: new Types.ObjectId(),
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      mockOrdersService.findAccessInfoByOrderId.mockResolvedValue(accessInfo());
      mockOrdersService.getStatusHistory.mockResolvedValue(history);
      mockOrdersService.getOrderStatus.mockResolvedValue(OrderStatus.ASSIGNED);
    });

    it('rejects customers who do not own the order', async () => {
      const req = {
        user: {
          userId: new Types.ObjectId().toString(),
          role: UserRole.CUSTOMER,
        },
      };
      await expect(
        controller.getOrderStatus(req, 'ORD-20260101-ABCDEF12'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        controller.getStatusHistory(req, 'ORD-20260101-ABCDEF12'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockOrdersService.getStatusHistory).not.toHaveBeenCalled();
    });

    it('rejects riders who are not assigned', async () => {
      const req = {
        user: { userId: new Types.ObjectId().toString(), role: UserRole.RIDER },
      };
      await expect(
        controller.getOrderStatus(req, 'ORD-20260101-ABCDEF12'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns 404 for unknown orders', async () => {
      mockOrdersService.findAccessInfoByOrderId.mockResolvedValue(null);
      const req = { user: { userId: ownerId, role: UserRole.CUSTOMER } };
      await expect(
        controller.getOrderStatus(req, 'ORD-UNKNOWN'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lets the owner and assigned rider read status', async () => {
      for (const user of [
        { userId: ownerId, role: UserRole.CUSTOMER },
        { userId: riderId, role: UserRole.RIDER },
      ]) {
        await expect(
          controller.getOrderStatus({ user }, 'ORD-20260101-ABCDEF12'),
        ).resolves.toEqual({
          orderId: 'ORD-20260101-ABCDEF12',
          status: OrderStatus.ASSIGNED,
        });
      }
    });

    it('strips changedBy ids from history for non-admins but not for admins', async () => {
      const ownerResult: any = await controller.getStatusHistory(
        { user: { userId: ownerId, role: UserRole.CUSTOMER } },
        'ORD-20260101-ABCDEF12',
      );
      expect(ownerResult.history[0]).not.toHaveProperty('changedBy');
      expect(ownerResult.history[0].newStatus).toBe(OrderStatus.CONFIRMED);

      const adminResult: any = await controller.getStatusHistory(
        {
          user: {
            userId: new Types.ObjectId().toString(),
            role: UserRole.ADMIN,
          },
        },
        'ORD-20260101-ABCDEF12',
      );
      expect(adminResult.history[0]).toHaveProperty('changedBy');
    });
  });

  describe('Rider delivery rules', () => {
    const riderId = new Types.ObjectId().toString();
    const orderId = new Types.ObjectId().toString();
    const req = { user: { userId: riderId, role: UserRole.RIDER } };

    it('forwards the delivery OTP to the service when marking DELIVERED', async () => {
      mockOrdersService.findById.mockResolvedValue({
        _id: new Types.ObjectId(orderId),
        riderId: new Types.ObjectId(riderId),
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      });
      mockOrdersService.updateStatus.mockResolvedValue({});

      await controller.updateOrderStatus(req, orderId, {
        status: OrderStatus.DELIVERED,
        deliveryOtp: '1234',
      });

      expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.DELIVERED,
        riderId,
        { actorRole: UserRole.RIDER, deliveryOtp: '1234' },
      );
    });

    it('does not let riders cancel after pickup', async () => {
      for (const orderStatus of [
        OrderStatus.PICKED_UP,
        OrderStatus.OUT_FOR_DELIVERY,
      ]) {
        mockOrdersService.findById.mockResolvedValue({
          _id: new Types.ObjectId(orderId),
          riderId: new Types.ObjectId(riderId),
          orderStatus,
        });
        await expect(
          controller.updateOrderStatus(req, orderId, {
            status: OrderStatus.CANCELLED,
          }),
        ).rejects.toThrow(ForbiddenException);
      }
      expect(mockOrdersService.updateStatus).not.toHaveBeenCalled();
    });

    it('does not give the assigned rider the delivery OTP via GET /orders/:id', async () => {
      mockOrdersService.findById.mockResolvedValue({
        _id: new Types.ObjectId(orderId),
        userId: new Types.ObjectId(),
        riderId: new Types.ObjectId(riderId),
      });
      mockOrdersService.getTrackingOrderById.mockResolvedValue({});

      await controller.getOrder(req, orderId);

      expect(mockOrdersService.getTrackingOrderById).toHaveBeenCalledWith(
        orderId,
        { includeDeliveryOtp: false },
      );
    });
  });
});

describe('AdminOrdersController', () => {
  const mockOrdersService = { updateStatus: jest.fn(), findAll: jest.fn() };
  let controller: AdminOrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();
    controller = module.get(AdminOrdersController);
    jest.clearAllMocks();
  });

  it('passes the admin role and note to the service', async () => {
    const adminId = new Types.ObjectId().toString();
    mockOrdersService.updateStatus.mockResolvedValue({});

    await controller.updateOrderStatus(
      { user: { userId: adminId, role: UserRole.ADMIN } },
      'order-id',
      { status: OrderStatus.CANCELLED, note: 'out of stock' },
    );

    expect(mockOrdersService.updateStatus).toHaveBeenCalledWith(
      'order-id',
      OrderStatus.CANCELLED,
      adminId,
      { actorRole: UserRole.ADMIN, reason: 'out of stock' },
    );
  });

  it('rejects rider-controlled statuses', async () => {
    await expect(
      controller.updateOrderStatus(
        { user: { userId: 'x', role: UserRole.ADMIN } },
        'order-id',
        { status: OrderStatus.DELIVERED },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
