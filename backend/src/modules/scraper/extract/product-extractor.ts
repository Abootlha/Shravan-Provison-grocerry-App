/**
 * Turns a product page's HTML into a store-ready product draft.
 *
 * Framework-free and synchronous so it can be unit tested with plain HTML
 * strings. Sources, most specific first:
 *   1. Blinkit: `window.grofers.PRELOADED_STATE` (images, MRP, unit, category
 *      path, nutrition, shelf life, veg flag).
 *   2. BigBasket: `__NEXT_DATA__` productDetails.
 *   3. Any site: schema.org JSON-LD (Product + BreadcrumbList), then
 *      OpenGraph / meta tags.
 * Competitor names and support e-mails are scrubbed from the copy.
 */

export type SourceSite = 'blinkit' | 'bigbasket' | 'zepto' | 'other';

export type DietaryFlag = 'Veg' | 'Non-Veg' | 'Vegan';
export type StorageFlag = 'Ambient' | 'Refrigerated' | 'Frozen';

export interface ExtractedNutrition {
  protein?: number;
  carbs?: number;
  sugar?: number;
  fat?: number;
  transFat?: number;
  servingSize?: string;
}

export interface ExtractedProduct {
  site: SourceSite;
  sourceId?: string;
  name: string;
  brand?: string;
  /** Selling price in rupees. */
  price?: number;
  /** MRP in rupees (>= price). */
  mrp?: number;
  unit?: string;
  description?: string;
  highlights?: string;
  /** Absolute image URLs, best quality first, de-duplicated. */
  images: string[];
  /** Source taxonomy, broadest first (e.g. ["Dairy", "Milk", "Toned Milk"]). */
  categoryPath: string[];
  shelfLifeDays?: number;
  dietary?: DietaryFlag;
  storage?: StorageFlag;
  nutrition?: ExtractedNutrition;
}

export class ScrapeBlockedError extends Error {}
export class ScrapeParseError extends Error {}

const COMPETITORS =
  /\b(blinkit|grofers|zepto(?:now)?|swiggy|instamart|zomato|big\s?basket|jiomart|dmart)\b/gi;
const COMPETITOR_EMAIL =
  /[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)*(?:blinkit|grofers|zeptonow|zepto|zomato|swiggy|bigbasket|jiomart)\.[a-z.]+/gi;

export const MAX_IMAGES = 15;

export function detectSite(url: string): SourceSite {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (/(^|\.)(blinkit|grofers)\.com$/.test(host)) return 'blinkit';
  if (/(^|\.)bigbasket\.com$/.test(host)) return 'bigbasket';
  if (/(^|\.)zepto(now)?\.com$/.test(host)) return 'zepto';
  return 'other';
}

/** Strips tracking params and the fragment so the same product dedupes. */
export function normalizeSourceUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|ref|fbclid|gclid|srsltid)/i.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export function extractProduct(
  html: string,
  pageUrl: string,
  storeEmail = 'support@shravanprovision.com',
): ExtractedProduct {
  if (looksBlocked(html)) {
    throw new ScrapeBlockedError(
      'The site blocked the scraper (bot protection). Try again later or add this product by hand.',
    );
  }

  const site = detectSite(pageUrl);
  const ld = parseJsonLd(html);
  const meta = parseMeta(html);

  let draft: Partial<ExtractedProduct> = {};
  if (site === 'blinkit') draft = fromBlinkitState(html) ?? {};
  else if (site === 'bigbasket') draft = fromBigBasketNextData(html) ?? {};

  const merged: ExtractedProduct = {
    site,
    sourceId: draft.sourceId ?? ld.product?.sku,
    name: draft.name || ld.product?.name || meta.title || '',
    brand: draft.brand || ld.product?.brand,
    price: firstPositive(draft.price, ld.product?.price, meta.price),
    mrp: firstPositive(draft.mrp),
    unit:
      draft.unit ||
      unitFromText(draft.name || ld.product?.name || meta.title || ''),
    description:
      draft.description || ld.product?.description || meta.description,
    highlights: draft.highlights || ld.product?.highlights,
    images: [],
    categoryPath: draft.categoryPath?.length
      ? draft.categoryPath
      : ld.breadcrumbs,
    shelfLifeDays: draft.shelfLifeDays,
    dietary: draft.dietary,
    storage: draft.storage,
    nutrition: draft.nutrition,
  };

  merged.images = uniqueImages(
    [
      ...(draft.images ?? []),
      ...(ld.product?.images ?? []),
      ...(meta.image ? [meta.image] : []),
    ],
    pageUrl,
  );

  if (merged.mrp === undefined || (merged.price && merged.mrp < merged.price)) {
    merged.mrp = merged.price;
  }

  merged.name = scrubName(merged.name);
  merged.description = scrubCopy(merged.description, storeEmail);
  merged.highlights = scrubCopy(merged.highlights, storeEmail);
  merged.categoryPath = merged.categoryPath
    .map((c) => c.trim())
    .filter((c) => c && !COMPETITORS.test(c) && !/^home$/i.test(c));
  COMPETITORS.lastIndex = 0;

  if (!merged.name) {
    throw new ScrapeParseError(
      'No product found on this page. Check that the link opens a single product.',
    );
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Blinkit

function fromBlinkitState(html: string): Partial<ExtractedProduct> | null {
  const state = readAssignedJson(html, 'window.grofers.PRELOADED_STATE');
  if (!state) return null;

  const product = findObject(
    state,
    (o) =>
      Array.isArray(o.attributes) &&
      Array.isArray(o.images) &&
      (typeof o.product_name === 'string' || typeof o.name === 'string'),
  );
  if (!product) return null;

  const attrs = new Map<string, string>();
  // Blinkit sends a display `name` and a different `attribute_name`
  // ("Unit" / "Unit (with options)"); index both.
  for (const a of product.attributes as any[]) {
    const value = a?.value == null ? '' : String(a.value).trim();
    if (!value) continue;
    for (const key of [a?.name, a?.attribute_name]) {
      const name = typeof key === 'string' ? key.trim().toLowerCase() : '';
      if (name && !attrs.has(name)) attrs.set(name, value);
    }
  }
  const attr = (...names: string[]) => {
    for (const n of names) {
      const v = attrs.get(n.toLowerCase());
      if (v) return v;
    }
    return undefined;
  };

  const categories = findObject(
    state,
    (o) => typeof o.l0_category === 'string' && o.l0_category.trim() !== '',
  );
  const categoryPath = categories
    ? [categories.l0_category, categories.l1_category, categories.l2_category]
        .filter((c) => typeof c === 'string' && c.trim())
        .map(String)
    : [];

  const description = joinSections([
    [null, attr('Description')],
    ['Ingredients', stripLabel(attr('Ingredients'), 'Ingredients')],
    ['Allergen information', attr('Allergen Information')],
    ['Shelf life', attr('Shelf Life')],
    ['Storage tips', attr('Storage Tips', 'Storage Instruction')],
    ['Country of origin', attr('Country of Origin')],
    [
      'Manufacturer',
      attr("Manufacturer's Name and Address", 'Manufacturer Details'),
    ],
    ['Marketed by', attr('Marketed By')],
    ['FSSAI license', attr('FSSAI License')],
  ]);

  const shelfDays = Number.parseInt(attr('Shelf Life (In days)') ?? '', 10);
  const foodType = (attr('Food Type') ?? '').toLowerCase();
  const temperature = (attr('temperature-type') ?? '').toUpperCase();

  const nutrition: ExtractedNutrition = {
    protein: grams(attr('Protein Per 100 g', 'Protein')),
    carbs: grams(attr('Total Carbohydrates Per 100 g', 'Carbohydrate')),
    sugar: grams(attr('Total Sugar Per 100 g', 'Added Sugar Per 100 g')),
    fat: grams(attr('Total Fat Per 100 g', 'Total Fat')),
    transFat: grams(attr('Trans Fat Per 100 g')),
  };
  const hasNutrition = Object.values(nutrition).some((v) => v !== undefined);

  return {
    sourceId: product.id != null ? String(product.id) : undefined,
    name: String(product.product_name ?? product.name ?? ''),
    brand: typeof product.brand === 'string' ? product.brand : undefined,
    price: toNumber(product.price),
    mrp: toNumber(product.mrp),
    unit: attr('Unit', 'Net Weight', 'Net Quantity', 'Quantity'),
    description,
    highlights: attr('Key Features', 'Highlights'),
    images: (product.images as unknown[]).filter(
      (i): i is string =>
        typeof i === 'string' && !/product_videos_thumbnails/.test(i),
    ),
    categoryPath,
    shelfLifeDays:
      Number.isFinite(shelfDays) && shelfDays > 0 ? shelfDays : undefined,
    dietary: foodType.startsWith('non')
      ? 'Non-Veg'
      : foodType === 'vegan'
        ? 'Vegan'
        : foodType.startsWith('veg')
          ? 'Veg'
          : undefined,
    storage: /FROZEN/.test(temperature)
      ? 'Frozen'
      : /CHILL|COLD|REFRIG/.test(temperature)
        ? 'Refrigerated'
        : temperature
          ? 'Ambient'
          : undefined,
    nutrition: hasNutrition ? { ...nutrition, servingSize: '100g' } : undefined,
  };
}

// ---------------------------------------------------------------------------
// BigBasket

function fromBigBasketNextData(html: string): Partial<ExtractedProduct> | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/,
  );
  if (!match) return null;
  let data: any;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }
  const child = data?.props?.pageProps?.productDetails?.children?.[0];
  if (!child) return null;

  const images: string[] = [];
  for (const img of child.images ?? []) {
    const url = img?.xl || img?.l || img?.m;
    if (typeof url === 'string') images.push(url);
  }
  const tabs: [string | null, string | undefined][] = [];
  for (const tab of child.tabs ?? []) {
    if (tab?.title && tab?.content) {
      tabs.push([String(tab.title), htmlToText(String(tab.content))]);
    }
  }
  const category = child.category ?? {};
  return {
    sourceId: child.id != null ? String(child.id) : undefined,
    name: child.desc,
    brand: child.brand?.name,
    price: toNumber(
      child.pricing?.discount?.prim_price?.sp ?? child.pricing?.discount?.sp,
    ),
    mrp: toNumber(child.pricing?.discount?.mrp),
    unit: child.w || child.weight,
    description: joinSections(tabs),
    images,
    categoryPath: [category.tlc_name, category.mlc_name, category.llc_name]
      .filter((c) => typeof c === 'string' && c.trim())
      .map(String),
  };
}

// ---------------------------------------------------------------------------
// Generic: JSON-LD and meta tags

interface LdResult {
  product?: {
    name?: string;
    brand?: string;
    description?: string;
    highlights?: string;
    price?: number;
    sku?: string;
    images: string[];
  };
  breadcrumbs: string[];
}

function parseJsonLd(html: string): LdResult {
  const result: LdResult = { breadcrumbs: [] };
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    let json: any;
    try {
      json = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const items: any[] = Array.isArray(json)
      ? json
      : (json['@graph'] ?? [json]);
    for (const item of items) {
      const type = item?.['@type'];
      const isType = (t: string) =>
        type === t || (Array.isArray(type) && type.includes(t));
      if (isType('Product') && !result.product) {
        const images: string[] = [];
        const img = item.image;
        for (const i of Array.isArray(img) ? img : [img]) {
          if (typeof i === 'string') images.push(i);
          else if (i?.url) images.push(i.url);
          else if (i?.contentUrl) images.push(i.contentUrl);
        }
        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        const features = (item.additionalProperty ?? []).find((p: any) =>
          /key features|highlights/i.test(p?.name ?? ''),
        );
        result.product = {
          name: item.name,
          brand: typeof item.brand === 'string' ? item.brand : item.brand?.name,
          description: stripBuyOnline(item.description),
          highlights: features?.value,
          price: toNumber(offer?.price ?? offer?.lowPrice),
          sku: item.sku != null ? String(item.sku) : undefined,
          images,
        };
      } else if (isType('BreadcrumbList') && !result.breadcrumbs.length) {
        const list = [...(item.itemListElement ?? [])].sort(
          (a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0),
        );
        const names = list
          .map((e: any) => e?.item?.name ?? e?.name)
          .filter((n: unknown): n is string => typeof n === 'string');
        // Drop the site root and the product itself (last crumb).
        result.breadcrumbs = names.slice(1, -1);
      }
    }
  }
  return result;
}

function parseMeta(html: string) {
  const get = (attr: string, name: string) => {
    const re = new RegExp(
      `<meta[^>]+${attr}=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${name}["']`,
      'i',
    );
    const m = html.match(re);
    return m ? decodeEntities(m[1] ?? m[2] ?? '').trim() : undefined;
  };
  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  return {
    title:
      get('property', 'og:title') ||
      (titleTag ? decodeEntities(titleTag).trim() : undefined),
    description: stripBuyOnline(
      get('property', 'og:description') || get('name', 'description'),
    ),
    image: get('property', 'og:image'),
    price: toNumber(get('property', 'product:price:amount')),
  };
}

// ---------------------------------------------------------------------------
// Helpers

function looksBlocked(html: string): boolean {
  const head = html.slice(0, 5000);
  return (
    /<title>\s*(Access Denied|Just a moment\.\.\.|Attention Required)/i.test(
      head,
    ) ||
    (html.length < 3000 && /captcha|are you a robot|access denied/i.test(html))
  );
}

/**
 * Reads `<marker> = {...}` from inline script and parses the JSON object.
 * The object end is found by brace matching that respects strings.
 */
/** Parsed object, or null when the marker is missing or the JSON is invalid. */
export function readAssignedJson(html: string, marker: string): any {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf('{', at + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(html.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Depth-first search for the first object matching `test`. */
/** Returns the match, or null. */
function findObject(root: unknown, test: (o: any) => boolean): any {
  const stack: unknown[] = [root];
  let visited = 0;
  while (stack.length && visited++ < 500_000) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (!Array.isArray(node) && test(node)) return node;
    const values = Array.isArray(node) ? node : Object.values(node);
    for (let i = values.length - 1; i >= 0; i--) stack.push(values[i]);
  }
  return null;
}

function uniqueImages(urls: string[], pageUrl: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = normalizeImageUrl(raw, pageUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

/** Absolute URL without CDN resize prefixes (full-size original). */
export function normalizeImageUrl(raw: string, pageUrl: string): string | null {
  if (!raw || /^data:/i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(decodeEntities(raw.trim()), pageUrl);
  } catch {
    return null;
  }
  if (url.pathname.includes('/_next/image')) {
    const inner = url.searchParams.get('url');
    if (inner) return normalizeImageUrl(inner, pageUrl);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  url.pathname = url.pathname
    .replace(/\/cdn-cgi\/image\/[^/]+\//, '/') // Blinkit / Cloudflare resizing
    .replace(/\/tr:[^/]+\//, '/'); // Zepto / ImageKit
  return url.toString();
}

function scrubName(name: string): string {
  const out = name.replace(COMPETITORS, '').replace(/\s{2,}/g, ' ');
  COMPETITORS.lastIndex = 0;
  return out
    .replace(/^(buy\s+)/i, '')
    .replace(/\s*[|\-–]\s*$/, '')
    .replace(/\s+online\s*$/i, '')
    .trim()
    .slice(0, 150);
}

function scrubCopy(text: string | undefined, storeEmail: string) {
  if (!text) return undefined;
  const out = text
    .replace(COMPETITOR_EMAIL, storeEmail)
    .replace(COMPETITORS, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  COMPETITORS.lastIndex = 0;
  return out || undefined;
}

/** Drops SEO boilerplate like "Buy X online in India at lowest price and get it delivered...". */
function stripBuyOnline(text?: string) {
  if (!text) return text;
  return text
    .replace(/^Buy .*?(?:easy returns|doorstep|online)[^.]*\.\s*/i, '')
    .trim();
}

function stripLabel(value: string | undefined, label: string) {
  return value?.replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), '');
}

function joinSections(sections: [string | null, string | undefined][]) {
  const parts = sections
    .filter(([, body]) => body && body.trim())
    .map(([title, body]) =>
      title ? `${title}:\n${body!.trim()}` : body!.trim(),
    );
  return parts.length ? parts.join('\n\n') : undefined;
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>|<\/(p|li|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function unitFromText(text: string) {
  const m = text.match(
    /(\d+(?:\.\d+)?\s*(?:kg|g|gm|mg|l|ltr|ml|pc|pcs|pieces|pack)\b(?:\s*[x×]\s*\d+)?)/i,
  );
  return m ? m[1].replace(/\s+/g, ' ').trim() : undefined;
}

function toNumber(value: unknown): number | undefined {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value.replace(/[^0-9.]/g, ''))
        : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}

function grams(value?: string) {
  if (!value) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function firstPositive(...values: (number | undefined)[]) {
  return values.find((v) => typeof v === 'number' && v > 0);
}
