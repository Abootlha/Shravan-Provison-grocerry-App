import { Taxonomy, suggestCategory, tokens } from './categorizer';

const taxonomy: Taxonomy = {
  categories: [
    { _id: 'c-dairy', name: 'Dairy & Eggs' },
    { _id: 'c-biscuits', name: 'Biscuits & Bakery' },
    { _id: 'c-snacks', name: 'Snacks' },
    { _id: 'c-old', name: 'Milk Products', isActive: false },
  ],
  subcategories: [
    { _id: 's-milk', name: 'Milk', parentId: 'c-dairy' },
    { _id: 's-paneer', name: 'Paneer & Cheese', parentId: 'c-dairy' },
    { _id: 's-cookies', name: 'Cookies', parentId: 'c-biscuits' },
    { _id: 's-chips', name: 'Chips & Crisps', parentId: 'c-snacks' },
  ],
  itemGroups: [
    { _id: 'g-toned', name: 'Toned Milk', parentId: 's-milk' },
    { _id: 'g-full', name: 'Full Cream Milk', parentId: 's-milk' },
    {
      _id: 'g-cashew',
      name: 'Nut Cookies',
      parentId: 's-cookies',
      tags: ['cashew', 'almond'],
    },
  ],
};

describe('suggestCategory', () => {
  it('maps a source path down to the item group', () => {
    const s = suggestCategory(taxonomy, {
      categoryPath: ['Dairy, Bread & Eggs', 'Milk', 'Toned Milk'],
      name: 'Amul Taaza Toned Milk 500 ml',
    });
    expect(s).toMatchObject({
      categoryId: 'c-dairy',
      subcategoryId: 's-milk',
      itemGroupId: 'g-toned',
      confidence: 'high',
      matched: ['Dairy & Eggs', 'Milk', 'Toned Milk'],
    });
  });

  it('matches singular and plural words and item-group tags', () => {
    const s = suggestCategory(taxonomy, {
      categoryPath: ['Bakery & Biscuits', 'Cookie'],
      name: 'Good Day Cashew Cookies',
    });
    expect(s).toMatchObject({
      categoryId: 'c-biscuits',
      subcategoryId: 's-cookies',
      itemGroupId: 'g-cashew',
    });
  });

  it('uses the product name when the source has no taxonomy', () => {
    const s = suggestCategory(taxonomy, {
      categoryPath: [],
      name: 'Lays Potato Chips Classic Salted',
    });
    expect(s).toMatchObject({
      categoryId: 'c-snacks',
      subcategoryId: 's-chips',
    });
  });

  it('a full match of a store category in the source path is high confidence', () => {
    const s = suggestCategory(
      {
        categories: [{ _id: 'c-bakery', name: 'Bakery & Biscuits' }],
        subcategories: [],
        itemGroups: [],
      },
      {
        categoryPath: ['Bakery & Biscuits', 'Cookies', 'Packaged Cookies'],
        name: 'Good Day Cashew Cookies',
      },
    );
    expect(s).toMatchObject({ categoryId: 'c-bakery', confidence: 'high' });
  });

  it('a name-only guess is never high confidence', () => {
    const s = suggestCategory(taxonomy, {
      categoryPath: [],
      name: 'Lays Potato Chips Classic Salted',
    });
    expect(s?.confidence).not.toBe('high');
  });

  it('ignores inactive categories and returns null without any match', () => {
    const s = suggestCategory(taxonomy, {
      categoryPath: ['Products'],
      name: 'Products',
    });
    expect(s).toBeNull();
    const milk = suggestCategory(taxonomy, {
      categoryPath: ['Milk Products'],
      name: 'x',
    });
    expect(milk?.categoryId).not.toBe('c-old');
  });

  it('tokenises without stopwords, numbers or ampersands', () => {
    expect(tokens('Cookies & Biscuits for 2 Kids')).toEqual([
      'cooky',
      'biscuit',
      'kid',
    ]);
  });
});
