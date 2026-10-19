import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  OrdersService,
  estimatedDeliveryMinutesOf,
  DEFAULT_DELIVERY_MINUTES,
} from './orders.service';
import { Order, PaymentMethod } from './schemas/order.schema';
import { OrderStatusLog } from './schemas/order-status-log.schema';
import { User } from '../users/schemas/user.schema';
import { Rider } from '../riders/schemas/rider.schema';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import { SettingsService } from '../settings/settings.service';
import { RedisService } from '../../common/utils/redis.service';
import { CacheService } from '../../common/utils/cache.service';
import { TrackingGateway } from '../../sockets/tracking.gateway';
import { ETAService } from './eta.service';
import { createFakeModel, fakeStoreSettings } from './testing/fake-model';
import { CreateOrderDto as CreateDto } from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';

describe('OrdersService - pack-size variants', () => {
  let service: OrdersService;
  let orderModel: any;
  const userId = new Types.ObjectId().toString();
  const attaId = new Types.ObjectId();
  const milkId = new Types.ObjectId();

  const atta = {
    _id: attaId,
    name: 'Aashirvaad Atta',
    image: 'https://cdn.example.com/atta.webp',
    isAvailable: true,
    price: 249,
    pricing: { mrp: 295, sellingPrice: 249 },
    pack: { unit: '5 kg' },
    stock: 50,
    variants: [
      {
        sku: 'ATTA-5',
        unit: '5 kg',
        mrp: 295,
        sellingPrice: 249,
        stock: 50,
        isDefault: true,
        isActive: true,
      },
      {
        sku: 'ATTA-10',
        unit: '10 kg',
        mrp: 560,
        sellingPrice: 479,
        stock: 2,
        isDefault: false,
        isActive: true,
      },
    ],
  };
  const milk = {
    _id: milkId,
    name: 'Milk',
    sku: 'SKU-MILK',
    isAvailable: true,
    price: 30,
    pricing: { mrp: 32, sellingPrice: 30 },
    pack: { unit: '500 ml' },
    stock: 10,
    variants: [],
  };

  const products = {
    findById: jest.fn((id: string) =>
      Promise.resolve(
        id === attaId.toString()
          ? atta
          : id === milkId.toString()
            ? milk
            : null,
      ),
    ),
    checkAndLockStock: jest.fn().mockResolvedValue(true),
    releaseStock: jest.fn(),
  };

  const address = {
    type: 'home',
    address: '1 Test St',
    city: 'Gorakhpur',
    pincode: '273001',
    latitude: 26.7,
    longitude: 83.3,
  };

  beforeEach(async () => {
    orderModel = createFakeModel({ hiddenFields: ['deliveryOtp'] });
    const statusLog: any = jest
      .fn()
      .mockImplementation(() => ({ save: jest.fn().mockResolvedValue(true) }));
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name), useValue: orderModel },
        { provide: getModelToken(OrderStatusLog.name), useValue: statusLog },
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
          },
        },
        { provide: getModelToken(Rider.name), useValue: createFakeModel() },
        { provide: getQueueToken('orders'), useValue: { add: jest.fn() } },
        {
          provide: CartService,
          useValue: { recalculateCart: jest.fn(), clearCart: jest.fn() },
        },
        { provide: ProductsService, useValue: products },
        {
          provide: SettingsService,
          useValue: {
            getStoreSettings: jest.fn().mockResolvedValue(fakeStoreSettings),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            publish: jest.fn(),
            getJSON: jest.fn(),
            setJSON: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrder: jest.fn(),
            setOrder: jest.fn(),
            deleteOrder: jest.fn(),
          },
        },
        {
          provide: TrackingGateway,
          useValue: {
            broadcastOrderStatusUpdate: jest.fn(),
            notifyRiderOrderCancelled: jest.fn(),
          },
        },
        {
          provide: ETAService,
          useValue: { calculateETA: jest.fn(), recalculateForOrder: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(OrdersService);
    jest.clearAllMocks();
  });

  it('quotes a variant line at the variant price with its pack and MRP', async () => {
    const quote = await service.quoteOrder(userId, [
      { productId: attaId.toString(), quantity: 1, variantSku: 'ATTA-10' },
      { productId: milkId.toString(), quantity: 2 },
    ]);
    expect(quote.itemTotal).toBe(479 + 60);
    expect(quote.items[0]).toMatchObject({
      variantSku: 'ATTA-10',
      unit: '10 kg',
      mrp: 560,
      price: 479,
      lineTotal: 479,
    });
    expect(quote.items[1]).toMatchObject({
      unit: '500 ml',
      mrp: 32,
      price: 30,
    });
    expect(quote.items[1]).not.toHaveProperty('variantSku');
  });

  it('snapshots sku, unit, mrp and image and reserves the variant stock', async () => {
    const order: any = await service.createOrder(userId, {
      deliveryAddress: address,
      paymentMethod: PaymentMethod.COD,
      items: [
        { productId: attaId.toString(), quantity: 2, variantSku: 'ATTA-10' },
        { productId: milkId.toString(), quantity: 1 },
      ],
    });

    expect(order.items[0]).toMatchObject({
      variantSku: 'ATTA-10',
      sku: 'ATTA-10',
      unit: '10 kg',
      mrp: 560,
      price: 479,
      image: atta.image,
      mirrorsTopLevel: false,
    });
    expect(order.items[1]).toMatchObject({
      sku: 'SKU-MILK',
      unit: '500 ml',
      mrp: 32,
      price: 30,
    });
    expect(order.itemTotal).toBe(479 * 2 + 30);
    expect(products.checkAndLockStock).toHaveBeenCalledWith([
      {
        productId: attaId.toString(),
        quantity: 2,
        variantSku: 'ATTA-10',
        mirror: false,
      },
      { productId: milkId.toString(), quantity: 1 },
    ]);
  });

  it('reserves the default pack (and its mirror) when an old client sends no sku', async () => {
    await service.createOrder(userId, {
      deliveryAddress: address,
      paymentMethod: PaymentMethod.COD,
      items: [{ productId: attaId.toString(), quantity: 1 }],
    });
    expect(products.checkAndLockStock).toHaveBeenCalledWith([
      {
        productId: attaId.toString(),
        quantity: 1,
        variantSku: 'ATTA-5',
        mirror: true,
      },
    ]);
  });

  it('rejects an unknown pack and more than the pack has in stock', async () => {
    await expect(
      service.quoteOrder(userId, [
        { productId: attaId.toString(), quantity: 1, variantSku: 'ATTA-99' },
      ]),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.quoteOrder(userId, [
        { productId: attaId.toString(), quantity: 3, variantSku: 'ATTA-10' },
      ]),
    ).rejects.toThrow('Insufficient stock for Aashirvaad Atta 10 kg');
  });

  it('releases a cancelled variant order back onto the variant', async () => {
    const order = orderModel.insert({
      items: [
        {
          productId: attaId,
          quantity: 2,
          price: 479,
          variantSku: 'ATTA-10',
          mirrorsTopLevel: false,
        },
        { productId: milkId, quantity: 1, price: 30 },
      ],
    });
    await service.releaseOrderStock(order);
    expect(products.releaseStock).toHaveBeenCalledWith([
      {
        productId: attaId.toString(),
        quantity: 2,
        variantSku: 'ATTA-10',
        mirror: false,
      },
      { productId: milkId.toString(), quantity: 1 },
    ]);
  });

  it('validates variantSku in the order and quote payloads', async () => {
    const item = {
      productId: attaId.toString(),
      quantity: 1,
      name: 'Atta',
      price: 479,
    };
    const ok = plainToInstance(QuoteOrderDto, {
      items: [{ ...item, variantSku: 'ATTA-10' }],
    });
    expect(await validate(ok)).toHaveLength(0);
    const bad = plainToInstance(QuoteOrderDto, {
      items: [{ ...item, variantSku: { $ne: null } }],
    });
    expect((await validate(bad)).length).toBeGreaterThan(0);
    const order = plainToInstance(CreateOrderDto, {
      items: [{ ...item, variantSku: 'ATTA 10; drop' }],
      itemTotal: 479,
      totalAmount: 479,
      deliveryAddress: address,
      paymentMethod: PaymentMethod.COD,
    });
    expect((await validate(order)).length).toBeGreaterThan(0);
  });

  it('sets estimatedDeliveryTime from settings.estimatedDeliveryMinutes', async () => {
    const settings = (service as any).settingsService;
    settings.getStoreSettings.mockResolvedValue({
      ...fakeStoreSettings,
      estimatedDeliveryMinutes: 10,
    });
    const before = Date.now();
    const order: any = await service.createOrder(userId, {
      deliveryAddress: address,
      paymentMethod: PaymentMethod.COD,
      items: [{ productId: milkId.toString(), quantity: 1 }],
    });
    const minutes = (order.estimatedDeliveryTime.getTime() - before) / 60000;
    expect(minutes).toBeGreaterThanOrEqual(9.9);
    expect(minutes).toBeLessThan(10.5);

    settings.getStoreSettings.mockResolvedValue(fakeStoreSettings);
    const fallback: any = await service.createOrder(userId, {
      deliveryAddress: address,
      paymentMethod: PaymentMethod.COD,
      items: [{ productId: milkId.toString(), quantity: 1 }],
    });
    expect(
      Math.round(
        (fallback.estimatedDeliveryTime.getTime() - Date.now()) / 60000,
      ),
    ).toBe(15);
  });

  it('accepts NETBANKING as a payment method (older CARD orders stay valid)', async () => {
    for (const paymentMethod of [
      PaymentMethod.NETBANKING,
      PaymentMethod.CARD,
    ]) {
      const dto = plainToInstance(CreateDto, {
        items: [
          {
            productId: milkId.toString(),
            name: 'Milk',
            quantity: 1,
            price: 30,
          },
        ],
        itemTotal: 30,
        totalAmount: 30,
        deliveryAddress: address,
        paymentMethod,
      });
      expect(await validate(dto)).toHaveLength(0);
    }
    const order: any = await service.createOrder(userId, {
      deliveryAddress: address,
      paymentMethod: PaymentMethod.NETBANKING,
      items: [{ productId: milkId.toString(), quantity: 1 }],
    });
    expect(order.paymentMethod).toBe('NETBANKING');
  });
});

describe('estimatedDeliveryTime', () => {
  it('reads the promise from store settings, falling back to 15 minutes', () => {
    expect(estimatedDeliveryMinutesOf({ estimatedDeliveryMinutes: 10 })).toBe(
      10,
    );
    expect(estimatedDeliveryMinutesOf({ estimatedDeliveryMinutes: 12.4 })).toBe(
      12,
    );
    expect(estimatedDeliveryMinutesOf({})).toBe(DEFAULT_DELIVERY_MINUTES);
    expect(estimatedDeliveryMinutesOf({ estimatedDeliveryMinutes: 0 })).toBe(
      15,
    );
    expect(estimatedDeliveryMinutesOf({ estimatedDeliveryMinutes: 'x' })).toBe(
      15,
    );
    expect(estimatedDeliveryMinutesOf(null)).toBe(15);
  });
});
