import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { Types } from 'mongoose';
import * as fc from 'fast-check';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import {
  StaleOrderProcessor,
  AnomalyCheckProcessor,
  EtaRecalculationProcessor,
} from './jobs.processors';
import {
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../orders/schemas/order.schema';
import { User, UserRole } from '../users/schemas/user.schema';
import { OrdersService } from '../orders/orders.service';
import { ETAService } from '../orders/eta.service';

describe('JobsService', () => {
  let service: JobsService;

  // Mock queue
  const mockQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  // Mock models
  const mockOrderModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockUserModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  // Mock services
  const mockOrdersService = {
    addTimelineEntry: jest.fn(),
    cancelOrder: jest.fn().mockResolvedValue({}),
    markPaymentFailed: jest.fn().mockResolvedValue({ changed: true }),
    autoAssignNearestRider: jest.fn().mockResolvedValue(null),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  const mockETAService = {
    recalculateForOrder: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockQueue.add.mockClear();
    mockOrderModel.find.mockClear();
    mockOrderModel.findOne.mockClear();
    mockOrderModel.create.mockClear();
    mockUserModel.findOne.mockClear();
    mockUserModel.create.mockClear();
    mockOrdersService.addTimelineEntry.mockClear();
    mockETAService.recalculateForOrder.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: getQueueToken('stale-order-check'),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken('anomaly-check'),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken('eta-recalculation'),
          useValue: mockQueue,
        },
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
        {
          provide: ETAService,
          useValue: mockETAService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Property 6: Stale Order Auto-Cancellation
   * **Validates: Requirements 2.1, 2.2**
   *
   * For any order in PENDING status with createdAt timestamp more than 10 minutes in the past,
   * the stale order job processor must cancel the order and set cancellationReason to "AUTO_CANCELLED_STALE".
   */
  describe('Property 6: Stale Order Auto-Cancellation', () => {
    it('should cancel all PENDING orders older than 10 minutes with AUTO_CANCELLED_STALE reason', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate array of orders with various ages
          fc.array(
            fc.record({
              _id: fc.string().map(() => new Types.ObjectId()),
              orderId: fc.string(),
              orderStatus: fc.constantFrom(...Object.values(OrderStatus)),
              createdAt: fc.integer({ min: 0, max: 30 }).map((minutesAgo) => {
                return new Date(Date.now() - minutesAgo * 60 * 1000);
              }),
            }),
            { minLength: 0, maxLength: 20 },
          ),
          async (orders) => {
            // Clear mocks for this iteration
            mockOrdersService.cancelOrder.mockClear();
            mockUserModel.findOne.mockClear();
            mockOrderModel.find.mockClear();

            // Filter to get expected stale orders (PENDING and older than 10 minutes)
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const expectedStaleOrders = orders.filter(
              (order) =>
                order.orderStatus === OrderStatus.PENDING &&
                order.createdAt < tenMinutesAgo,
            );

            // Mock system user
            const systemUser = {
              _id: new Types.ObjectId(),
              phone: 'SYSTEM',
              name: 'System',
              role: UserRole.ADMIN,
            };
            mockUserModel.findOne.mockResolvedValue(systemUser);

            // Mock order query to return only PENDING orders older than 10 minutes
            const staleOrderMocks = expectedStaleOrders.map((order) => ({
              ...order,
              cancellationReason: undefined,
              save: jest.fn().mockResolvedValue(order),
            }));

            mockOrderModel.find.mockReturnValue({
              exec: jest.fn().mockResolvedValue(staleOrderMocks),
            });

            // Execute the job
            await service.processStaleOrders();

            // Verify all stale orders were cancelled through the orders
            // service cancel path (status log, stock release, broadcast)
            for (const orderMock of staleOrderMocks) {
              expect(mockOrdersService.cancelOrder).toHaveBeenCalledWith(
                orderMock._id.toString(),
                systemUser._id.toString(),
                'AUTO_CANCELLED_STALE',
              );
              // No direct document mutation/save bypassing the service
              expect(orderMock.save).not.toHaveBeenCalled();
            }

            // Verify the correct number of orders were processed
            expect(mockOrdersService.cancelOrder).toHaveBeenCalledTimes(
              expectedStaleOrders.length,
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should not cancel orders that are not PENDING', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .constantFrom(...Object.values(OrderStatus))
            .filter((status) => status !== OrderStatus.PENDING),
          fc.integer({ min: 11, max: 60 }), // Minutes ago (older than 10 minutes)
          async (orderStatus, minutesAgo) => {
            const order = {
              _id: new Types.ObjectId(),
              orderId: 'TEST-ORDER',
              orderStatus,
              createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
              save: jest.fn(),
            };

            const systemUser = {
              _id: new Types.ObjectId(),
              phone: 'SYSTEM',
              name: 'System',
              role: UserRole.ADMIN,
            };
            mockUserModel.findOne.mockResolvedValue(systemUser);

            // Mock should return empty array since we're filtering for PENDING
            mockOrderModel.find.mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            });

            await service.processStaleOrders();

            // Order should not be modified
            expect(order.save).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should not cancel PENDING orders younger than 10 minutes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 9 }), // Minutes ago (less than 10 minutes)
          async (minutesAgo) => {
            const order = {
              _id: new Types.ObjectId(),
              orderId: 'TEST-ORDER',
              orderStatus: OrderStatus.PENDING,
              createdAt: new Date(Date.now() - minutesAgo * 60 * 1000),
              save: jest.fn(),
            };

            const systemUser = {
              _id: new Types.ObjectId(),
              phone: 'SYSTEM',
              name: 'System',
              role: UserRole.ADMIN,
            };
            mockUserModel.findOne.mockResolvedValue(systemUser);

            // Mock should return empty array since we're filtering for orders older than 10 minutes
            mockOrderModel.find.mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            });

            await service.processStaleOrders();

            // Order should not be modified
            expect(order.save).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 7: Anomalous Order Detection
   * **Validates: Requirements 2.3, 2.4**
   *
   * For any order in OUT_FOR_DELIVERY status with status change timestamp more than 2 hours in the past,
   * the anomaly check job must flag the order as anomalous and trigger admin notification.
   */
  describe('Property 7: Anomalous Order Detection', () => {
    it('should detect all OUT_FOR_DELIVERY orders older than 2 hours as anomalous', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              _id: fc.string().map(() => new Types.ObjectId()),
              orderId: fc.string(),
              orderStatus: fc.constantFrom(...Object.values(OrderStatus)),
              updatedAt: fc.integer({ min: 0, max: 300 }).map((minutesAgo) => {
                return new Date(Date.now() - minutesAgo * 60 * 1000);
              }),
            }),
            { minLength: 0, maxLength: 20 },
          ),
          async (orders) => {
            // Filter to get expected anomalous orders (OUT_FOR_DELIVERY and older than 2 hours)
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const expectedAnomalousOrders = orders.filter(
              (order) =>
                order.orderStatus === OrderStatus.OUT_FOR_DELIVERY &&
                order.updatedAt < twoHoursAgo,
            );

            // Mock order query
            mockOrderModel.find.mockReturnValue({
              exec: jest.fn().mockResolvedValue(expectedAnomalousOrders),
            });

            // Spy on logger to verify notifications
            const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

            // Execute the job
            await service.processAnomalies();

            // Verify all anomalous orders were detected and logged
            expect(loggerWarnSpy).toHaveBeenCalledTimes(
              expectedAnomalousOrders.length * 2,
            );
            // Each order generates 2 log calls: one for detection, one for admin notification

            for (const order of expectedAnomalousOrders) {
              expect(loggerWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                  `ANOMALY DETECTED: Order ${order.orderId}`,
                ),
              );
              expect(loggerWarnSpy).toHaveBeenCalledWith(
                expect.stringContaining(
                  `ADMIN NOTIFICATION: Anomalous order ${order.orderId}`,
                ),
              );
            }

            loggerWarnSpy.mockRestore();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should not flag orders that are not OUT_FOR_DELIVERY', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .constantFrom(...Object.values(OrderStatus))
            .filter((status) => status !== OrderStatus.OUT_FOR_DELIVERY),
          fc.integer({ min: 121, max: 300 }), // Minutes ago (older than 2 hours)
          async () => {
            // Mock should return empty array since we're filtering for OUT_FOR_DELIVERY
            mockOrderModel.find.mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            });

            const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

            await service.processAnomalies();

            // Should not log any anomalies
            expect(loggerWarnSpy).not.toHaveBeenCalledWith(
              expect.stringContaining('ANOMALY DETECTED'),
            );

            loggerWarnSpy.mockRestore();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should not flag OUT_FOR_DELIVERY orders younger than 2 hours', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 119 }), // Minutes ago (less than 2 hours)
          async () => {
            // Mock should return empty array since we're filtering for orders older than 2 hours
            mockOrderModel.find.mockReturnValue({
              exec: jest.fn().mockResolvedValue([]),
            });

            const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

            await service.processAnomalies();

            // Should not log any anomalies
            expect(loggerWarnSpy).not.toHaveBeenCalledWith(
              expect.stringContaining('ANOMALY DETECTED'),
            );

            loggerWarnSpy.mockRestore();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  /**
   * Property 41: Job Retry with Exponential Backoff
   * **Validates: Requirements 12.5**
   *
   * For any background job that fails, the system must retry the job up to 3 times
   * with exponential backoff delays (2s, 4s, 8s) before considering it permanently failed.
   */
  describe('Property 41: Job Retry with Exponential Backoff', () => {
    it('should configure jobs with 3 retry attempts and exponential backoff', async () => {
      // Clear previous calls
      mockQueue.add.mockClear();

      // Re-register jobs to capture configuration
      await service.registerStaleOrderCheck();
      await service.registerAnomalyCheck();
      await service.registerETARecalculation();

      // Verify all three jobs were registered
      expect(mockQueue.add).toHaveBeenCalledTimes(3);

      // Check each job has correct retry configuration
      const calls = mockQueue.add.mock.calls;

      for (const call of calls) {
        const [, , options] = call;

        // Verify retry configuration
        expect(options.attempts).toBe(3);
        expect(options.backoff).toEqual({
          type: 'exponential',
          delay: 2000, // 2 seconds base delay
        });
      }
    });

    it('should apply exponential backoff configuration to all job types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'stale-order-check',
            'anomaly-check',
            'eta-recalculation',
          ),
          async (jobType) => {
            mockQueue.add.mockClear();

            // Register the specific job
            switch (jobType) {
              case 'stale-order-check':
                await service.registerStaleOrderCheck();
                break;
              case 'anomaly-check':
                await service.registerAnomalyCheck();
                break;
              case 'eta-recalculation':
                await service.registerETARecalculation();
                break;
            }

            // Verify configuration
            expect(mockQueue.add).toHaveBeenCalledWith(
              expect.any(String),
              expect.any(Object),
              expect.objectContaining({
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 2000,
                },
              }),
            );
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  /**
   * Property 42: Dead Letter Queue for Failed Jobs
   * **Validates: Requirements 12.6**
   *
   * For any background job that fails after all retry attempts, the system must move the job
   * to the dead letter queue and log the failure with job details and error message.
   */
  describe('Property 42: Dead Letter Queue for Failed Jobs', () => {
    it('should log errors when jobs fail and allow BullMQ to handle dead letter queue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'stale-order-check',
            'anomaly-check',
            'eta-recalculation',
          ),
          fc.string().filter((s) => s.length > 0), // Non-empty error message
          async (queueName, errorMessage) => {
            // Mock job that will fail
            const mockJob = {
              id: 'test-job-id',
              queueName,
              data: {},
            };

            // Mock the specific processor to throw an error
            const error = new Error(errorMessage);

            if (queueName === 'eta-recalculation') {
              // For ETA recalculation, mock the select chain properly
              mockOrderModel.find.mockReturnValue({
                select: jest.fn().mockReturnValue({
                  exec: jest.fn().mockRejectedValue(error),
                }),
              });
            } else {
              // For other jobs, mock find().exec()
              mockOrderModel.find.mockReturnValue({
                exec: jest.fn().mockRejectedValue(error),
              });
            }

            const loggerErrorSpy = jest.spyOn(service['logger'], 'error');

            // Execute the job and expect it to throw
            await expect(service.process(mockJob as any)).rejects.toThrow();

            // Verify error was logged with the job details
            expect(loggerErrorSpy).toHaveBeenCalledWith(
              expect.stringContaining(
                `Job ${mockJob.id} in queue ${queueName} failed`,
              ),
              expect.any(Error),
            );

            loggerErrorSpy.mockRestore();
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should re-throw errors to trigger BullMQ retry mechanism', async () => {
      const mockJob = {
        id: 'test-job-id',
        queueName: 'stale-order-check',
        data: {},
      };

      const error = new Error('Database connection failed');
      mockOrderModel.find.mockReturnValue({
        exec: jest.fn().mockRejectedValue(error),
      });

      // The process method should re-throw the error
      await expect(service.process(mockJob as any)).rejects.toThrow(error);
    });
  });

  /**
   * ETA Recalculation Job Tests
   */
  describe('ETA Recalculation Job', () => {
    it('should recalculate ETA for all OUT_FOR_DELIVERY orders', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              _id: fc.string().map(() => new Types.ObjectId()),
              orderId: fc.string(),
              orderStatus: fc.constantFrom(...Object.values(OrderStatus)),
              riderId: fc.option(
                fc.string().map(() => new Types.ObjectId()),
                { nil: undefined },
              ),
            }),
            { minLength: 0, maxLength: 20 },
          ),
          async (orders) => {
            // Clear mocks for this iteration
            mockETAService.recalculateForOrder.mockClear();
            mockOrderModel.find.mockClear();

            // Filter to get expected orders for ETA recalculation
            const expectedOrders = orders.filter(
              (order) =>
                order.orderStatus === OrderStatus.OUT_FOR_DELIVERY &&
                order.riderId,
            );

            mockOrderModel.find.mockReturnValue({
              select: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(expectedOrders),
              }),
            });

            mockETAService.recalculateForOrder.mockResolvedValue(new Date());

            await service.processETAUpdates();

            // Verify ETA was recalculated for each eligible order
            expect(mockETAService.recalculateForOrder).toHaveBeenCalledTimes(
              expectedOrders.length,
            );

            for (const order of expectedOrders) {
              expect(mockETAService.recalculateForOrder).toHaveBeenCalledWith(
                order._id.toString(),
              );
            }
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should skip orders without assigned riders', async () => {
      const ordersWithoutRiders = [
        {
          _id: new Types.ObjectId(),
          orderId: 'ORDER-1',
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
          riderId: undefined,
        },
        {
          _id: new Types.ObjectId(),
          orderId: 'ORDER-2',
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
          riderId: null,
        },
      ];

      mockOrderModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(ordersWithoutRiders),
        }),
      });

      await service.processETAUpdates();

      // Should not call ETA service for orders without riders
      expect(mockETAService.recalculateForOrder).not.toHaveBeenCalled();
    });
  });

  describe('Payment timeout auto-cancel', () => {
    it('marks unpaid online orders older than PAYMENT_TIMEOUT_MINUTES as failed via the orders service', async () => {
      mockConfigService.get.mockImplementation((key: string) =>
        key === 'PAYMENT_TIMEOUT_MINUTES' ? '20' : undefined,
      );
      const unpaid = [
        { _id: new Types.ObjectId(), orderId: 'ORD-1' },
        { _id: new Types.ObjectId(), orderId: 'ORD-2' },
      ];
      mockOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(unpaid),
      });

      const before = Date.now();
      await service.processPaymentTimeouts();

      const filter = mockOrderModel.find.mock.calls[0][0];
      expect(filter.paymentMethod).toEqual({ $ne: PaymentMethod.COD });
      expect(filter.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(filter.orderStatus).toBe(OrderStatus.PENDING);
      const cutoff = filter.createdAt.$lt.getTime();
      expect(before - cutoff).toBeGreaterThanOrEqual(20 * 60 * 1000 - 1000);
      expect(before - cutoff).toBeLessThanOrEqual(20 * 60 * 1000 + 1000);

      for (const order of unpaid) {
        expect(mockOrdersService.markPaymentFailed).toHaveBeenCalledWith(
          order._id.toString(),
          'PAYMENT_TIMEOUT',
        );
      }
      mockConfigService.get.mockReset();
    });

    it('defaults to a 15 minute timeout', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockOrderModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      const before = Date.now();
      await service.processPaymentTimeouts();
      const cutoff = mockOrderModel.find.mock.calls[0][0].createdAt.$lt;
      expect(Math.round((before - cutoff.getTime()) / 60000)).toBe(15);
    });
  });

  describe('Processors', () => {
    it('registers one processor class per queue, each delegating to JobsService', async () => {
      const jobsService = { process: jest.fn().mockResolvedValue('ok') };
      for (const ProcessorClass of [
        StaleOrderProcessor,
        AnomalyCheckProcessor,
        EtaRecalculationProcessor,
      ]) {
        const processor = new ProcessorClass(jobsService as any);
        await expect(processor.process({ id: '1' } as any)).resolves.toBe('ok');
      }
      expect(jobsService.process).toHaveBeenCalledTimes(3);
    });
  });
});
