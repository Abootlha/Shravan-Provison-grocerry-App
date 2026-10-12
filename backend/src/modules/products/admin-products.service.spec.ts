import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  AdminProductsService,
  productIssues,
  stockStateOf,
} from './admin-products.service';
import { ProductsService } from './products.service';
import { ProductStatus, isProductSellable } from './schemas/product.schema';
import { StockAdjustmentReason } from './schemas/stock-adjustment.schema';
import { createFakeModel } from '../orders/testing/fake-model';

describe('ProductsService.buildUpdate', () => {
  it('only sets fields that were provided (no forced isAvailable)', () => {
    const update = ProductsService.buildUpdate({
      name: 'Atta',
      isAvailable: undefined,
      stock: undefined,
    });
    expect(update).toEqual({ $set: { name: 'Atta' } });
  });

  it('keeps isAvailable false when explicitly sent', () => {
    expect(ProductsService.buildUpdate({ isAvailable: false })).toEqual({
      $set: { isAvailable: false },
    });
  });

  it('mirrors legacy price/unit fields into pricing/pack and unsets an empty barcode', () => {
    expect(
      ProductsService.buildUpdate({
        price: 45,
        originalPrice: 50,
        unit: '1kg',
        gst: 5,
        barcode: '',
      }),
    ).toEqual({
      $set: {
        price: 45,
        originalPrice: 50,
        unit: '1kg',
        'pricing.sellingPrice': 45,
        'pricing.mrp': 50,
        'pack.unit': '1kg',
        'pricing.gst': 5,
      },
      $unset: { barcode: 1 },
    });
  });
});

describe('product helpers', () => {
  it('flags products that need attention', () => {
    expect(
      productIssues({ price: 10, image: 'https://x/y.png', unit: '1kg' }),
    ).toEqual([]);
    expect(productIssues({ price: 0, images: [], unit: '' })).toEqual([
      'missing_price',
      'no_image',
      'missing_unit',
    ]);
    expect(
      productIssues({
        pricing: { sellingPrice: 20 },
        images: ['https://x'],
        unit: '8047675773 G',
      }),
    ).toEqual(['unit_looks_like_barcode']);
  });

  it('uses one low-stock rule: 0 < stock <= reorderLevel (default 10)', () => {
    expect(stockStateOf({ stock: 0 })).toBe('out');
    expect(stockStateOf({ stock: -1 })).toBe('out');
    expect(stockStateOf({ stock: 10 })).toBe('low');
    expect(stockStateOf({ stock: 11 })).toBe('ok');
    expect(stockStateOf({ stock: 4, reorderLevel: 3 })).toBe('ok');
  });

  it('treats products without status as active, never sells drafts/archived/unpriced', () => {
    expect(isProductSellable({ isAvailable: true, price: 5 })).toBe(true);
    expect(
      isProductSellable({ isAvailable: true, price: 5, status: 'draft' }),
    ).toBe(false);
    expect(
      isProductSellable({ isAvailable: true, price: 5, status: 'archived' }),
    ).toBe(false);
    expect(isProductSellable({ isAvailable: true, price: 0 })).toBe(false);
    expect(isProductSellable({ isAvailable: false, price: 5 })).toBe(false);
  });
});

describe('AdminProductsService', () => {
  let productModel: any;
  let adjustmentModel: any;
  let productsService: { invalidateProduct: jest.Mock };
  let service: AdminProductsService;

  beforeEach(() => {
    productModel = createFakeModel();
    adjustmentModel = {
      create: jest.fn((doc: any) =>
        Promise.resolve({
          _id: new Types.ObjectId(),
          ...doc,
        }),
      ),
    };
    productsService = { invalidateProduct: jest.fn() };
    service = new AdminProductsService(
      productModel,
      adjustmentModel,
      productsService as any,
    );
  });

  it('adjusts stock atomically, records the reason and invalidates caches', async () => {
    const product = productModel.insert({ name: 'Rice', stock: 5 });
    const result = await service.adjustStock(
      product._id.toString(),
      { delta: 7, reason: StockAdjustmentReason.RESTOCK, note: ' truck ' },
      { userId: new Types.ObjectId().toString(), role: 'manager' },
    );

    expect(productModel.get(product._id).stock).toBe(12);
    expect(result.product).toMatchObject({ stock: 12, stockState: 'ok' });
    expect(adjustmentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        delta: 7,
        previousStock: 5,
        newStock: 12,
        reason: 'restock',
        note: 'truck',
        actorRole: 'manager',
      }),
    );
    expect(productsService.invalidateProduct).toHaveBeenCalledWith(
      product._id.toString(),
    );
  });

  it('never takes stock below zero', async () => {
    const product = productModel.insert({ name: 'Rice', stock: 2 });
    await expect(
      service.adjustStock(product._id.toString(), {
        delta: -3,
        reason: StockAdjustmentReason.DAMAGE,
      }),
    ).rejects.toThrow(ConflictException);
    expect(productModel.get(product._id).stock).toBe(2);
    expect(adjustmentModel.create).not.toHaveBeenCalled();
  });

  it('404s for unknown products', async () => {
    await expect(
      service.adjustStock(new Types.ObjectId().toString(), {
        delta: 1,
        reason: StockAdjustmentReason.CORRECTION,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('builds list filters for status, stock and attention', () => {
    expect(service.buildFilter({ page: 1, limit: 20 } as any)).toEqual({});

    const active = service.buildFilter({ status: ProductStatus.ACTIVE } as any);
    expect(active.$and[0]).toEqual({ status: { $in: ['active', null] } });

    const low = service.buildFilter({ stock: 'low' } as any);
    expect(low.$and).toEqual([
      { stock: { $gt: 0 } },
      {
        $expr: { $lte: ['$stock', { $ifNull: ['$reorderLevel', 10] }] },
      },
    ]);

    const search = service.buildFilter({ q: 'a.b' } as any);
    expect(search.$and[0].$or[0]).toEqual({
      name: { $regex: 'a\\.b', $options: 'i' },
    });

    const attention = service.buildFilter({ needsAttention: true } as any);
    expect(attention.$and[0].$or).toHaveLength(5);
  });
});
