import { Types } from 'mongoose';
import { ProductsService } from './products.service';
import { createFakeModel } from '../orders/testing/fake-model';

describe('ProductsService - stock locking', () => {
  let service: ProductsService;
  let productModel: any;
  const redis = { del: jest.fn() };

  beforeEach(() => {
    productModel = createFakeModel();
    service = new ProductsService(productModel, redis as any, {} as any);
  });

  const seed = (stock: number) =>
    productModel.insert({ _id: new Types.ObjectId(), stock, soldCount: 0 });

  it('decrements every item when all have enough stock', async () => {
    const a = seed(5);
    const b = seed(3);

    await expect(
      service.checkAndLockStock([
        { productId: a._id.toString(), quantity: 2 },
        { productId: b._id.toString(), quantity: 3 },
      ]),
    ).resolves.toBe(true);

    expect(productModel.get(a._id).stock).toBe(3);
    expect(productModel.get(b._id).stock).toBe(0);
    expect(productModel.get(b._id).soldCount).toBe(3);
  });

  it('uses a conditional update so stock can never go negative', async () => {
    const a = seed(2);

    await service.checkAndLockStock([
      { productId: a._id.toString(), quantity: 1 },
    ]);

    expect(productModel.updateOne).toHaveBeenCalledWith(
      { _id: a._id.toString(), stock: { $gte: 1 } },
      { $inc: { stock: -1, soldCount: 1 } },
    );
  });

  it('rolls back already-decremented items when a later item is short', async () => {
    const a = seed(5);
    const b = seed(1);
    const c = seed(10);

    await expect(
      service.checkAndLockStock([
        { productId: a._id.toString(), quantity: 2 },
        { productId: c._id.toString(), quantity: 4 },
        { productId: b._id.toString(), quantity: 2 },
      ]),
    ).resolves.toBe(false);

    expect(productModel.get(a._id)).toMatchObject({ stock: 5, soldCount: 0 });
    expect(productModel.get(b._id)).toMatchObject({ stock: 1, soldCount: 0 });
    expect(productModel.get(c._id)).toMatchObject({ stock: 10, soldCount: 0 });
  });

  it('does not oversell under concurrent orders for the last unit', async () => {
    const a = seed(1);
    const item = [{ productId: a._id.toString(), quantity: 1 }];

    const results = await Promise.all([
      service.checkAndLockStock(item),
      service.checkAndLockStock(item),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(productModel.get(a._id).stock).toBe(0);
  });

  it('rejects non-positive quantities and rolls back', async () => {
    const a = seed(5);
    const b = seed(5);

    await expect(
      service.checkAndLockStock([
        { productId: a._id.toString(), quantity: 1 },
        { productId: b._id.toString(), quantity: 0 },
      ]),
    ).resolves.toBe(false);
    expect(productModel.get(a._id).stock).toBe(5);
  });

  it('fails for unknown products', async () => {
    await expect(
      service.checkAndLockStock([
        { productId: new Types.ObjectId().toString(), quantity: 1 },
      ]),
    ).resolves.toBe(false);
  });
});
