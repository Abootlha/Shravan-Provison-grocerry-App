import { Types } from 'mongoose';
import { ProductsService, isFreshCategory } from './products.service';

const chain = (result: any) => {
  const q: any = {};
  ['sort', 'select', 'lean', 'populate'].forEach((m) => {
    q[m] = jest.fn(() => q);
  });
  q.exec = jest.fn().mockResolvedValue(result);
  return q;
};

describe('ProductsService.findHome', () => {
  const fruits = { _id: new Types.ObjectId(), name: 'Fruits & Vegetables' };
  const biscuits = { _id: new Types.ObjectId(), name: 'Bakery & Biscuits' };
  const empty = { _id: new Types.ObjectId(), name: 'Home Furnishing & Decor' };

  const p = (name: string) => ({ _id: new Types.ObjectId(), name });
  const apple = p('Apple');
  const banana = p('Banana');
  const parleG = p('Parle G');

  let productModel: any;
  let categoryModel: any;
  let redis: any;
  let service: ProductsService;

  beforeEach(() => {
    categoryModel = { find: jest.fn(() => chain([fruits, biscuits, empty])) };
    productModel = {
      aggregate: jest.fn().mockResolvedValue([
        { _id: String(biscuits._id), ids: [parleG._id], total: 26 },
        { _id: String(fruits._id), ids: [banana._id, apple._id], total: 2 },
      ]),
      // returned out of order: the service must restore the ranked order
      find: jest.fn(() => chain([apple, parleG, banana])),
    };
    redis = { getJSON: jest.fn().mockResolvedValue(null), setJSON: jest.fn() };
    service = new ProductsService(
      productModel,
      redis,
      { get: () => 300 } as any,
      { version: jest.fn().mockResolvedValue('7'), bump: jest.fn() } as any,
      categoryModel,
    );
  });

  it('returns one shelf per non-empty category in category order', async () => {
    const feed = await service.findHome(12);

    expect(feed.sections.map((s) => s.category.name)).toEqual([
      'Fruits & Vegetables',
      'Bakery & Biscuits',
    ]);
    expect(feed.sections[0]).toMatchObject({ fresh: true, total: 2 });
    expect(feed.sections[0].products.map((x: any) => x.name)).toEqual([
      'Banana',
      'Apple',
    ]);
    expect(feed.sections[1]).toMatchObject({ fresh: false, total: 26 });
    expect(feed.total).toBe(28);
    expect(feed.perCategory).toBe(12);
  });

  it('uses one aggregation and one populated find for all categories', async () => {
    await service.findHome(5);

    expect(categoryModel.find).toHaveBeenCalledWith({
      type: 'category',
      isActive: true,
    });
    expect(productModel.aggregate).toHaveBeenCalledTimes(1);
    const [match, sort, , project] = productModel.aggregate.mock.calls[0][0];
    expect(match.$match).toMatchObject({
      isAvailable: true,
      status: { $in: ['active', null] },
    });
    expect(match.$match.$or).toEqual([
      { stock: { $gt: 0 } },
      {
        variants: {
          $elemMatch: { stock: { $gt: 0 }, isActive: { $ne: false } },
        },
      },
    ]);
    expect(match.$match.categoryId.$in).toHaveLength(6); // ObjectIds + strings
    expect(sort.$sort).toEqual({ soldCount: -1, createdAt: -1, _id: -1 });
    expect(project.$project.ids).toEqual({ $slice: ['$ids', 5] });
    expect(productModel.find).toHaveBeenCalledTimes(1);
    expect(redis.setJSON).toHaveBeenCalledWith(
      'products:v7:home:5',
      expect.any(Object),
      300,
    );
  });

  it('serves a cached feed without querying', async () => {
    redis.getJSON.mockResolvedValue({
      sections: [],
      perCategory: 12,
      total: 0,
    });
    await service.findHome(12);
    expect(categoryModel.find).not.toHaveBeenCalled();
    expect(productModel.aggregate).not.toHaveBeenCalled();
  });

  it('returns an empty feed when no category has stock', async () => {
    productModel.aggregate.mockResolvedValue([]);
    const feed = await service.findHome(12);
    expect(feed).toEqual({ sections: [], perCategory: 12, total: 0 });
    expect(productModel.find).not.toHaveBeenCalled();
  });
});

describe('isFreshCategory', () => {
  it.each([
    ['Fruits & Vegetables', true],
    ['Fresh Vegetables', true],
    ['Dairy, Bread & Eggs', true],
    ['Dairy & Breakfast', true],
    ['Milk & Curd', true],
    ['Tea , Coffee & Milk', false],
    ['Bakery & Biscuits', false],
    ['Instant & Frozen', false],
    ['Spices , Oil & More', false],
  ])('%s -> %s', (name, fresh) => {
    expect(isFreshCategory({ name })).toBe(fresh);
  });

  it('uses the category group when set', () => {
    expect(isFreshCategory({ name: 'Seasonal', group: 'Fresh produce' })).toBe(
      true,
    );
  });
});
