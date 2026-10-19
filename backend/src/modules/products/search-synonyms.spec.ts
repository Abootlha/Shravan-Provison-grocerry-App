import { ProductsService } from './products.service';
import { expandSearchTerms } from './search-synonyms';

describe('expandSearchTerms', () => {
  it('adds the catalogue word for Hinglish terms and keeps the original', () => {
    expect(expandSearchTerms('doodh')).toBe('doodh milk');
    expect(expandSearchTerms('Aloo')).toBe('aloo potato');
    expect(expandSearchTerms('pyaaz tamatar')).toBe(
      'pyaaz tamatar onion tomato',
    );
  });

  it('understands Devanagari, including vowel signs', () => {
    expect(expandSearchTerms('दूध')).toBe('दूध milk');
    expect(expandSearchTerms('आलू')).toBe('आलू potato');
  });

  it('expands phrases before single words', () => {
    expect(expandSearchTerms('hari mirch')).toBe('hari mirch green chilli');
  });

  it('leaves plain English alone and drops punctuation', () => {
    expect(expandSearchTerms('Amul milk!')).toBe('amul milk');
    expect(expandSearchTerms('   ')).toBe('');
  });

  it('caps the number of words', () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
    expect(expandSearchTerms(long).split(' ')).toHaveLength(16);
  });
});

describe('ProductsService.findAll search', () => {
  const chain = () => {
    const q: any = {};
    ['skip', 'limit', 'sort', 'populate'].forEach((m) => {
      q[m] = jest.fn(() => q);
    });
    q.exec = jest.fn().mockResolvedValue([]);
    return q;
  };

  it('sends the expanded words to $text and skips the list cache', async () => {
    const productModel: any = {
      find: jest.fn(() => chain()),
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    const redis: any = { getJSON: jest.fn(), setJSON: jest.fn() };
    const service = new ProductsService(
      productModel,
      redis,
      { get: () => 300 } as any,
      { version: jest.fn().mockResolvedValue('1'), bump: jest.fn() } as any,
      {} as any,
    );

    await service.findAll({ search: 'doodh', page: 1, limit: 20 });

    const filter = productModel.find.mock.calls[0][0];
    expect(filter.$text).toEqual({ $search: 'doodh milk' });
    expect(filter.isAvailable).toBe(true);
    expect(redis.getJSON).not.toHaveBeenCalled();
    expect(redis.setJSON).not.toHaveBeenCalled();
  });
});
