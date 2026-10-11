import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CategoriesService } from './categories.service';
import { CategoryType } from './schemas/category.schema';
import { AdminCatalogListQueryDto } from '../../common/dto/admin-catalog-query.dto';

const errorsFor = (cls: any, body: Record<string, unknown>) =>
  validate(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('Category DTOs', () => {
  it('icon is optional; group/groupHi are accepted', async () => {
    expect(
      await errorsFor(CreateCategoryDto, {
        name: 'Dairy',
        color: '#fff',
        group: 'Grocery & Kitchen',
        groupHi: 'किराना',
      }),
    ).toHaveLength(0);
    expect(await errorsFor(UpdateCategoryDto, { icon: '' })).toHaveLength(0);
  });

  it('still validates an icon when one is sent', async () => {
    expect(
      (
        await errorsFor(CreateCategoryDto, {
          name: 'Dairy',
          color: '#fff',
          icon: 'javascript:alert(1)',
        })
      ).length,
    ).toBeGreaterThan(0);
  });

  it('parses includeInactive from the query string', () => {
    expect(
      plainToInstance(AdminCatalogListQueryDto, { includeInactive: 'true' })
        .includeInactive,
    ).toBe(true);
    expect(
      plainToInstance(AdminCatalogListQueryDto, { includeInactive: 'false' })
        .includeInactive,
    ).toBe(false);
  });
});

describe('CategoriesService (admin)', () => {
  const exec = jest.fn().mockResolvedValue([]);
  const model: any = {
    find: jest.fn(() => ({ sort: () => ({ lean: () => ({ exec }) }) })),
    findById: jest.fn().mockResolvedValue({ parentId: undefined }),
    findByIdAndUpdate: jest.fn().mockResolvedValue({ _id: 'c1' }),
  };
  const redis = { del: jest.fn() };
  const catalog = { bump: jest.fn() };
  const service = new CategoriesService(model, redis as any, catalog as any);

  beforeEach(() => jest.clearAllMocks());

  it('includes deactivated categories only when asked', async () => {
    await service.adminFindAll({});
    expect(model.find).toHaveBeenLastCalledWith({
      type: CategoryType.CATEGORY,
      isActive: true,
    });
    await service.adminFindAll({ includeInactive: true });
    expect(model.find).toHaveBeenLastCalledWith({
      type: CategoryType.CATEGORY,
    });
  });

  it('bumps the catalogue version on change so product lists refresh', async () => {
    await service.update('c1', { isActive: true } as any);
    expect(catalog.bump).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('categories:all');
  });
});
