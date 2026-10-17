import {
  ScrapeBlockedError,
  ScrapeParseError,
  detectSite,
  extractProduct,
  normalizeImageUrl,
  normalizeSourceUrl,
  readAssignedJson,
} from './product-extractor';

const BLINKIT_URL = 'https://blinkit.com/prn/amul-taaza-toned-milk/prid/123';

function blinkitPage() {
  const state = {
    ui: {
      pdp: {
        bar: {
          common_attributes: {
            l0_category: 'Dairy, Bread & Eggs',
            l1_category: 'Milk',
            l2_category: 'Toned Milk',
          },
        },
        seo: {
          product_name: 'Amul Taaza Toned Milk',
          id: 123,
          brand: 'Amul',
          price: 28,
          mrp: 29,
          images: [
            'https://cdn.grofers.com/da/cms-assets/cms/product/a.jpg',
            'https://cdn.grofers.com/da/cms-assets/cms/product_videos_thumbnails/v.jpg',
            'https://cdn.grofers.com/da/cms-assets/cms/product/b.jpg',
          ],
          attributes: [
            {
              name: 'Description',
              attribute_name: 'Description',
              value: 'Fresh toned milk from Blinkit.',
            },
            {
              name: 'Key Features',
              attribute_name: 'Key Features',
              value: 'Pasteurised\nRich in calcium',
            },
            {
              name: 'Unit',
              attribute_name: 'Unit (with options)',
              value: '500 ml',
            },
            {
              name: 'Shelf Life (In days)',
              attribute_name: 'Shelf Life (In days)',
              value: '2',
            },
            { name: 'Food Type', attribute_name: 'food_type', value: 'veg' },
            { name: 'temperature-type', attribute_name: '', value: 'CHILLED' },
            {
              name: 'Protein Per 100 g',
              attribute_name: 'Protein',
              value: '3.1 g',
            },
            {
              name: 'Customer Care Details',
              attribute_name: 'Customer Care Details',
              value: 'Email: info@blinkit.com',
            },
            {
              name: 'Ingredients',
              attribute_name: 'Ingredients',
              value: 'Ingredients: Milk. Mail care@blinkit.com',
            },
          ],
        },
      },
    },
  };
  return `<html><head><title>Buy Amul Taaza | Blinkit</title></head><body>
  <script>window.grofers = {}; window.grofers.PRELOADED_STATE = ${JSON.stringify(state)}; window.grofers.CONFIG = {"a":"}"};</script>
  </body></html>`;
}

describe('extractProduct', () => {
  it('reads Blinkit preloaded state: price, MRP, unit, path, images, attributes', () => {
    const p = extractProduct(blinkitPage(), BLINKIT_URL, 'help@store.test');
    expect(p).toMatchObject({
      site: 'blinkit',
      sourceId: '123',
      name: 'Amul Taaza Toned Milk',
      brand: 'Amul',
      price: 28,
      mrp: 29,
      unit: '500 ml',
      categoryPath: ['Dairy, Bread & Eggs', 'Milk', 'Toned Milk'],
      highlights: 'Pasteurised\nRich in calcium',
      shelfLifeDays: 2,
      dietary: 'Veg',
      storage: 'Refrigerated',
    });
    expect(p.nutrition?.protein).toBe(3.1);
    // Video thumbnails are not product photos.
    expect(p.images).toEqual([
      'https://cdn.grofers.com/da/cms-assets/cms/product/a.jpg',
      'https://cdn.grofers.com/da/cms-assets/cms/product/b.jpg',
    ]);
  });

  it('scrubs competitor names and e-mails from the copy', () => {
    const p = extractProduct(blinkitPage(), BLINKIT_URL, 'help@store.test');
    expect(p.description).not.toMatch(/blinkit/i);
    expect(p.description).toContain('help@store.test');
    expect(p.description).toContain('Ingredients:\nMilk.');
  });

  it('falls back to JSON-LD Product and BreadcrumbList on any site', () => {
    const html = `<html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'BreadcrumbList',
        itemListElement: [
          { position: 1, item: { name: 'Home' } },
          { position: 2, item: { name: 'Snacks' } },
          { position: 3, item: { name: 'Chips' } },
          { position: 4, item: { name: 'Lays Classic 52g' } },
        ],
      })}</script>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Lays Classic Salted 52 g',
        brand: { '@type': 'Brand', name: 'Lays' },
        image: [
          '/img/lays.jpg',
          'https://shop.test/cdn-cgi/image/w=120/img/lays2.jpg',
        ],
        offers: { '@type': 'Offer', price: '20.00' },
      })}</script></head><body></body></html>`;
    const p = extractProduct(html, 'https://shop.test/p/lays');
    expect(p).toMatchObject({
      site: 'other',
      name: 'Lays Classic Salted 52 g',
      brand: 'Lays',
      price: 20,
      mrp: 20,
      unit: '52 g',
      categoryPath: ['Snacks', 'Chips'],
    });
    expect(p.images).toEqual([
      'https://shop.test/img/lays.jpg',
      'https://shop.test/img/lays2.jpg',
    ]);
  });

  it('uses OpenGraph tags when there is no structured data', () => {
    const html = `<html><head>
      <meta property="og:title" content="Tata Salt 1 kg" />
      <meta property="og:image" content="https://shop.test/salt.png" />
      <meta property="product:price:amount" content="28" />
    </head></html>`;
    expect(extractProduct(html, 'https://shop.test/salt')).toMatchObject({
      name: 'Tata Salt 1 kg',
      price: 28,
      unit: '1 kg',
      images: ['https://shop.test/salt.png'],
    });
  });

  it('reports bot-protection pages as blocked', () => {
    expect(() =>
      extractProduct('<html><title>Access Denied</title></html>', BLINKIT_URL),
    ).toThrow(ScrapeBlockedError);
  });

  it('fails clearly when the page has no product', () => {
    expect(() =>
      extractProduct('<html><body></body></html>', 'https://x.test/'),
    ).toThrow(ScrapeParseError);
  });
});

describe('helpers', () => {
  it('detects source sites', () => {
    expect(detectSite('https://blinkit.com/prn/x')).toBe('blinkit');
    expect(detectSite('https://www.bigbasket.com/pd/1/')).toBe('bigbasket');
    expect(detectSite('https://www.zeptonow.com/pn/x')).toBe('zepto');
    expect(detectSite('https://example.com/')).toBe('other');
  });

  it('normalises source URLs for de-duplication', () => {
    expect(
      normalizeSourceUrl(
        'https://Blinkit.com/prn/x/prid/1?utm_source=a&size=2#top',
      ),
    ).toBe('https://blinkit.com/prn/x/prid/1?size=2');
  });

  it('strips CDN resize prefixes and unwraps Next.js image URLs', () => {
    expect(
      normalizeImageUrl(
        'https://cdn.grofers.com/cdn-cgi/image/f=auto,w=120/da/p/a.jpg',
        BLINKIT_URL,
      ),
    ).toBe('https://cdn.grofers.com/da/p/a.jpg');
    expect(
      normalizeImageUrl(
        '/_next/image?url=https%3A%2F%2Fcdn.test%2Fa.png&w=640',
        'https://shop.test/p',
      ),
    ).toBe('https://cdn.test/a.png');
    expect(
      normalizeImageUrl('data:image/png;base64,xx', BLINKIT_URL),
    ).toBeNull();
  });

  it('reads an assigned JSON object even with braces inside strings', () => {
    expect(
      readAssignedJson('x.y = {"a":"}{","b":{"c":1}}; z = 2', 'x.y'),
    ).toEqual({
      a: '}{',
      b: { c: 1 },
    });
    expect(readAssignedJson('nothing here', 'x.y')).toBeNull();
  });
});
