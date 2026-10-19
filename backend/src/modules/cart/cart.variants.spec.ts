import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { createFakeModel } from '../orders/testing/fake-model';

describe('CartService - pack-size variants', () => {
  const userId = new Types.ObjectId().toString();
  const attaId = new Types.ObjectId();
  const atta = {
    _id: attaId,
    name: 'Atta',
    isAvailable: true,
    price: 249,
    pricing: { mrp: 295, sellingPrice: 249 },
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
        isActive: true,
      },
    ],
  };
  let cartModel: any;
  let service: CartService;

  beforeEach(() => {
    cartModel = createFakeModel();
    service = new CartService(
      cartModel,
      { findById: jest.fn().mockResolvedValue(atta) } as any,
      {
        getJSON: jest.fn().mockResolvedValue(null),
        setJSON: jest.fn(),
        del: jest.fn(),
      } as any,
      { get: () => 60 } as any,
    );
  });

  const lines = () => [...cartModel.store.values()][0].items;

  it('keeps one line per pack size, priced from the variant', async () => {
    await service.addToCart(userId, attaId.toString(), 1, 'ATTA-10');
    await service.addToCart(userId, attaId.toString(), 2, 'ATTA-5');
    const cart = await service.addToCart(
      userId,
      attaId.toString(),
      1,
      'ATTA-10',
    );

    expect(lines()).toEqual([
      expect.objectContaining({
        variantSku: 'ATTA-10',
        quantity: 2,
        price: 479,
      }),
      expect.objectContaining({
        variantSku: 'ATTA-5',
        quantity: 2,
        price: 249,
      }),
    ]);
    expect(cart.items[0]).toMatchObject({
      unit: '10 kg',
      mrp: 560,
      variantSku: 'ATTA-10',
    });
    expect(cart.total).toBe(479 * 2 + 249 * 2);
  });

  it('checks the variant stock, not the product stock', async () => {
    await expect(
      service.addToCart(userId, attaId.toString(), 3, 'ATTA-10'),
    ).rejects.toThrow('Insufficient stock');
    await expect(
      service.addToCart(userId, attaId.toString(), 1, 'NOPE'),
    ).rejects.toThrow(BadRequestException);
  });

  it('removes only the requested pack size', async () => {
    await service.addToCart(userId, attaId.toString(), 1, 'ATTA-10');
    await service.addToCart(userId, attaId.toString(), 1, 'ATTA-5');
    await service.removeFromCart(userId, attaId.toString(), 'ATTA-10');
    expect(lines()).toEqual([
      expect.objectContaining({ variantSku: 'ATTA-5' }),
    ]);
  });
});
