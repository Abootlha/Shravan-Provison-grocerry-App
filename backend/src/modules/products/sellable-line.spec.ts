import { Types } from 'mongoose';
import { ProductsService } from './products.service';
import { sellableLine } from './sellable-line';
import { createFakeModel } from '../orders/testing/fake-model';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { normalizeVariants } from './dto/variant.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const atta = (overrides: Record<string, any> = {}) => ({
  _id: new Types.ObjectId(),
  name: 'Aashirvaad Atta',
  sku: 'SKU-ATTA',
  isAvailable: true,
  price: 249,
  originalPrice: 295,
  pricing: { mrp: 295, sellingPrice: 249 },
  pack: { unit: '5 kg' },
  unit: '5 kg',
  stock: 50,
  soldCount: 0,
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
      stock: 3,
      isDefault: false,
      isActive: true,
    },
    {
      sku: 'ATTA-25',
      unit: '25 kg',
      mrp: 1300,
      sellingPrice: 1100,
      stock: 9,
      isDefault: false,
      isActive: false,
    },
  ],
  ...overrides,
});

describe('sellableLine', () => {
  it('prices a product without variants exactly as before', () => {
    const line = sellableLine({
      isAvailable: true,
      sku: 'SKU-MILK',
      price: 30,
      pricing: { mrp: 32, sellingPrice: 30 },
      pack: { unit: '500 ml' },
      stock: 7,
      variants: [],
    });
    expect(line).toEqual({
      sku: 'SKU-MILK',
      unit: '500 ml',
      mrp: 32,
      price: 30,
      stock: 7,
      mirrorsTopLevel: false,
    });
  });

  it('uses the requested variant for price, MRP, unit and stock', () => {
    expect(sellableLine(atta(), 'ATTA-10')).toEqual({
      variantSku: 'ATTA-10',
      sku: 'ATTA-10',
      unit: '10 kg',
      mrp: 560,
      price: 479,
      stock: 3,
      mirrorsTopLevel: false,
    });
  });

  it('falls back to the default variant when no sku is sent', () => {
    expect(sellableLine(atta())).toMatchObject({
      variantSku: 'ATTA-5',
      price: 249,
      mirrorsTopLevel: true,
    });
  });

  it('rejects unknown and inactive skus, and unsellable products', () => {
    expect(sellableLine(atta(), 'NOPE')).toBeNull();
    expect(sellableLine(atta(), 'ATTA-25')).toBeNull();
    expect(sellableLine(atta({ isAvailable: false }), 'ATTA-10')).toBeNull();
  });

  it('rejects a variant without a price instead of selling it at 0', () => {
    const p = atta();
    p.variants[1].sellingPrice = 0;
    expect(sellableLine(p, 'ATTA-10')).toBeNull();
  });
});

describe('ProductsService - variant stock', () => {
  let service: ProductsService;
  let productModel: any;

  beforeEach(() => {
    productModel = createFakeModel();
    service = new ProductsService(
      productModel,
      { del: jest.fn() } as any,
      {} as any,
      { bump: jest.fn(), version: jest.fn().mockResolvedValue('0') } as any,
      {} as any,
    );
  });

  const seed = () => productModel.insert(atta());
  const variant = (doc: any, sku: string) =>
    productModel.get(doc._id).variants.find((v: any) => v.sku === sku);

  it('reserves on the variant with a guarded positional $inc', async () => {
    const p = seed();
    await expect(
      service.checkAndLockStock([
        { productId: p._id.toString(), quantity: 2, variantSku: 'ATTA-10' },
      ]),
    ).resolves.toBe(true);

    expect(productModel.updateOne).toHaveBeenCalledWith(
      {
        _id: p._id.toString(),
        variants: {
          $elemMatch: {
            sku: 'ATTA-10',
            isActive: { $ne: false },
            stock: { $gte: 2 },
          },
        },
      },
      { $inc: { 'variants.$.stock': -2, soldCount: 2 } },
    );
    expect(variant(p, 'ATTA-10').stock).toBe(1);
    // the default pack and the product mirror are untouched
    expect(variant(p, 'ATTA-5').stock).toBe(50);
    expect(productModel.get(p._id).stock).toBe(50);
  });

  it('never oversells a variant', async () => {
    const p = seed();
    await expect(
      service.checkAndLockStock([
        { productId: p._id.toString(), quantity: 4, variantSku: 'ATTA-10' },
      ]),
    ).resolves.toBe(false);
    expect(variant(p, 'ATTA-10').stock).toBe(3);
  });

  it('keeps the top-level mirror in step for the default variant', async () => {
    const p = seed();
    await service.checkAndLockStock([
      {
        productId: p._id.toString(),
        quantity: 5,
        variantSku: 'ATTA-5',
        mirror: true,
      },
    ]);
    expect(variant(p, 'ATTA-5').stock).toBe(45);
    expect(productModel.get(p._id).stock).toBe(45);

    await service.releaseStock([
      {
        productId: p._id.toString(),
        quantity: 5,
        variantSku: 'ATTA-5',
        mirror: true,
      },
    ]);
    expect(variant(p, 'ATTA-5').stock).toBe(50);
    expect(productModel.get(p._id)).toMatchObject({ stock: 50, soldCount: 0 });
  });

  it('rolls back an earlier variant line when a later line is short', async () => {
    const p = seed();
    const milk = productModel.insert({
      _id: new Types.ObjectId(),
      stock: 1,
      soldCount: 0,
    });
    await expect(
      service.checkAndLockStock([
        { productId: p._id.toString(), quantity: 2, variantSku: 'ATTA-10' },
        { productId: milk._id.toString(), quantity: 2 },
      ]),
    ).resolves.toBe(false);
    expect(variant(p, 'ATTA-10').stock).toBe(3);
    expect(productModel.get(p._id).soldCount).toBe(0);
  });

  it('does not reserve an inactive variant', async () => {
    const p = seed();
    await expect(
      service.checkAndLockStock([
        { productId: p._id.toString(), quantity: 1, variantSku: 'ATTA-25' },
      ]),
    ).resolves.toBe(false);
    expect(variant(p, 'ATTA-25').stock).toBe(9);
  });
});

describe('product variants: admin edits', () => {
  const rows = [
    { sku: 'A-5', unit: '5 kg', mrp: 295, sellingPrice: 249, stock: 50 },
    {
      sku: 'A-10',
      unit: '10 kg',
      mrp: 560,
      sellingPrice: 479,
      stock: 3,
      isDefault: true,
    },
  ];

  it('stores one default and mirrors it onto the product fields', () => {
    const update = ProductsService.buildUpdate({ variants: rows });
    expect(
      update.$set.variants.map((v: any) => [v.sku, v.isDefault, v.isActive]),
    ).toEqual([
      ['A-5', false, true],
      ['A-10', true, true],
    ]);
    expect(update.$set).toMatchObject({
      price: 479,
      originalPrice: 560,
      unit: '10 kg',
      stock: 3,
      'pricing.sellingPrice': 479,
      'pricing.mrp': 560,
      'pack.unit': '10 kg',
    });
  });

  it('picks the first active pack as default when none is flagged', () => {
    const { variants } = normalizeVariants([
      { ...rows[0], isActive: false },
      { ...rows[1], isDefault: false },
    ] as any);
    expect(variants.map((v) => v.isDefault)).toEqual([false, true]);
  });

  it('rejects duplicate SKUs, price above MRP and two defaults', async () => {
    const check = async (variants: any[]) =>
      validate(plainToInstance(UpdateProductDto, { variants }));
    expect(await check(rows)).toHaveLength(0);
    expect(
      (await check([rows[0], { ...rows[1], sku: 'a-5' }])).length,
    ).toBeGreaterThan(0);
    expect(
      (await check([{ ...rows[0], sellingPrice: 300 }])).length,
    ).toBeGreaterThan(0);
    expect(
      (await check([{ ...rows[0], isDefault: true }, rows[1]])).length,
    ).toBeGreaterThan(0);
    expect(
      (await check([{ ...rows[0], sku: 'bad sku!' }])).length,
    ).toBeGreaterThan(0);
  });
});
