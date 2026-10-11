/**
 * Home curation — the editorial config and the pure builder that turns real catalogue data
 * (products, categories, past orders, store settings) into an ordered list of Home sections.
 *
 * Nothing here invents data. Every collection is a keyword filter over fields the backend
 * already returns (product name, populated subcategory/category names, price, MRP, stock,
 * isPerishable, shelfLife, attributes.storage, soldCount/reviewCount). A section that ends up
 * with too few products is dropped rather than padded.
 *
 * Copy lives in constants/translations.js under `homeFeed.*` (English + Hindi); the config only
 * holds translation keys. Titles arrive as { lead, emphasis, trail } and render as one plain
 * sentence-case title (the mixed-weight Headline is reserved for the Home hero line).
 *
 * SECTION_ORDER is the page rhythm — layouts alternate so no two neighbours look alike:
 *   carousel → editorial card + rail → rail → grid → chips + rail → 2-up tiles → rail
 *   → themed block → aisle rails
 */
import { discountOf, idOf, nameOf } from './catalog';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Page order. `type` picks the renderer in HomeScreen; `style` is the visual treatment. */
export const SECTION_ORDER = [
    { id: 'banners', type: 'banners', style: 'carousel' },
    { id: 'moment', type: 'moment', style: 'editorial', min: 4, limit: 12 },
    { id: 'again', type: 'rail', source: 'orders', style: 'rail', min: 3, limit: 10 },
    { id: 'grid', type: 'grid', style: 'grid', limit: 8 },
    { id: 'price', type: 'priceStore', style: 'chips', min: 4, limit: 12 },
    { id: 'fresh', type: 'fresh', style: 'tiles2up', min: 2, limit: 4 },
    { id: 'deals', type: 'rail', source: 'discount', style: 'rail', minDiscount: 10, min: 4, limit: 10 },
    { id: 'season', type: 'season', style: 'themed', min: 4, limit: 10 },
    { id: 'aisles', type: 'aisles', style: 'rail', count: 3, min: 3, limit: 12 },
];

/**
 * "Moment" collections, chosen by the hour. `include` / `exclude` run against a product's
 * name + subcategory + category (English source names, so they match in either language).
 */
export const MOMENTS = [
    {
        id: 'breakfast',
        hours: [5, 11],
        eyebrowKey: 'homeFeed.eyebrow.morning',
        titleKey: 'homeFeed.moment.breakfast',
        include: /\bmilk\b|bread|\bpav\b|\beggs?\b|butter|dahi|curd|paneer|\btea\b|coffee|banana/,
        exclude: /chocolate|cleaner|shampoo|bathing|toothpaste|cerelac|baby/,
    },
    {
        id: 'snack',
        hours: [11, 16],
        eyebrowKey: 'homeFeed.eyebrow.afternoon',
        titleKey: 'homeFeed.moment.snack',
        include: /snack|munch|chips|namkeen|bhujia|biscuit|cookie|noodle|juice|soft drink|cold drink|chocolate/,
        exclude: /cleaner|detergent/,
    },
    {
        id: 'dinner',
        hours: [16, 21],
        eyebrowKey: 'homeFeed.eyebrow.evening',
        titleKey: 'homeFeed.moment.dinner',
        include: /\batta\b|\bdals?\b|\brice\b|masala|spice|\boils?\b|ghee|\bsalt\b|tomato|onion|potato|chilli|coriander|besan/,
        exclude: /chips|namkeen|snack|bhujia|noodle|ketchup/,
    },
    {
        id: 'lateNight',
        hours: [21, 29], // 21:00 → 05:00 next day
        eyebrowKey: 'homeFeed.eyebrow.late',
        titleKey: 'homeFeed.moment.lateNight',
        include: /snack|chips|namkeen|bhujia|cookie|biscuit|noodle|cold drink|soft drink|chocolate|ice ?cream/,
        exclude: /cleaner|detergent/,
    },
];

/**
 * Seasonal themes, by calendar window (MM-DD, inclusive; windows may wrap the year).
 * The first match wins; `staples` has no window and is the tasteful default.
 */
export const SEASONS = [
    {
        id: 'festive',
        from: '10-01',
        to: '11-20',
        titleKey: 'homeFeed.season.festive',
        include: /ghee|besan|\batta\b|\boils?\b|sugar|dry ?fruit|cashew|almond|kaju|badam|sweet|mithai|bhujia|namkeen/,
        exclude: /cleaner|chips/,
    },
    {
        id: 'winter',
        from: '12-01',
        to: '02-28',
        titleKey: 'homeFeed.season.winter',
        include: /\btea\b|coffee|ghee|honey|soup|jaggery|\bgur\b|dry ?fruit/,
    },
    {
        id: 'summer',
        from: '03-01',
        to: '05-31',
        titleKey: 'homeFeed.season.summer',
        // word boundaries matter: "Classic" contains "lassi"
        include: /juice|soft drink|cold drink|\bdahi\b|\bcurd|\blassi\b|ice ?cream|mango|aamras|buttermilk/,
    },
    {
        id: 'monsoon',
        from: '06-01',
        to: '09-30',
        titleKey: 'homeFeed.season.monsoon',
        include: /chips|namkeen|bhujia|\btea\b|coffee|noodle|besan|pakod|ketchup/,
        exclude: /cleaner/,
    },
    {
        id: 'staples',
        titleKey: 'homeFeed.season.staples',
        include: /\batta\b|\brice\b|\bdals?\b|\boils?\b|\bsalt\b/,
        exclude: /toilet|cleaner/,
    },
];

/** Price-store chips (client-side filter on the selling price). */
export const PRICE_STORES = [49, 99];

// ---------------------------------------------------------------------------
// Time (dev override: ?homeAt=8 for the hour, ?homeDate=2026-07-15 for the season, web only)
// ---------------------------------------------------------------------------

const devParam = (key) => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
    try {
        const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
        return search ? new URLSearchParams(search).get(key) : null;
    } catch {
        return null;
    }
};

export function resolveNow() {
    const now = new Date();
    const date = devParam('homeDate');
    if (date && !Number.isNaN(Date.parse(date))) {
        const d = new Date(date);
        now.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const hour = Number(devParam('homeAt'));
    if (devParam('homeAt') != null && Number.isFinite(hour)) now.setHours(hour, 0, 0, 0);
    return now;
}

export const momentFor = (now) => {
    const h = now.getHours();
    return MOMENTS.find(({ hours: [a, b] }) => (h >= a && h < b) || (h + 24 >= a && h + 24 < b)) || MOMENTS[0];
};

const mmdd = (s) => {
    const [m, d] = s.split('-').map(Number);
    return m * 100 + d;
};

export const seasonsFor = (now) => {
    const today = (now.getMonth() + 1) * 100 + now.getDate();
    const inWindow = ({ from, to }) => {
        if (!from || !to) return false;
        const a = mmdd(from);
        const b = mmdd(to);
        return a <= b ? today >= a && today <= b : today >= a || today <= b;
    };
    // the dated theme first, then the default as a fallback when the dated one has too few products
    return [...SEASONS.filter(inWindow), ...SEASONS.filter((s) => !s.from)];
};

// ---------------------------------------------------------------------------
// Derivation helpers (pure)
// ---------------------------------------------------------------------------

export const productCategoryId = (prod) =>
    prod.categoryId?._id || prod.categoryId?.id || (typeof prod.categoryId === 'string' ? prod.categoryId : 'uncategorized');

// Name + subcategory. The category name is only a fallback: aisle names are broad ("Masala & Oil")
// and would pull salt into an "oil" collection.
const haystack = (p) => {
    const sub = p.subcategoryId?.name || p.subcategory || p.subCategoryName || p.subcategoryName;
    return [p.name, sub || p.categoryId?.name || p.categoryName]
        .filter((x) => typeof x === 'string')
        .join(' ')
        .toLowerCase();
};

const matches = (p, { include, exclude }) => {
    const text = haystack(p);
    return include.test(text) && !(exclude && exclude.test(text));
};

export const isAvailable = (p) => p.isAvailable !== false && (p.stock == null || p.stock > 0);

const popularity = (p) => Number(p.soldCount) || Number(p.reviewCount) || 0;
const byPopularity = (a, b) => popularity(b) - popularity(a);

/** Matching, in-stock products, most popular first. */
export const collect = (available, rule, limit) => available.filter((p) => matches(p, rule)).sort(byPopularity).slice(0, limit);

/** Fruits & vegetables: perishable products in a produce category. */
const isProduce = (p) => {
    const cat = `${p.categoryId?.name || p.categoryName || ''} ${p.subcategory || p.subcategoryId?.name || ''}`.toLowerCase();
    return /fruit|veg|herb|produce|sabzi/.test(cat);
};

/** Freshness facts the record actually carries (storage + shelf life). Null when it has neither. */
export const freshnessOf = (p) => {
    const storage = p.attributes?.storage || p.storage;
    if (/refrigerat|chill|frozen/i.test(storage || '')) return { kind: 'chilled' };
    const days = Number(p.shelfLife);
    if (p.isPerishable && days > 0 && days <= 7) return { kind: 'shelf', days };
    return null;
};

const buyAgain = (available, orders) => {
    const counts = new Map();
    orders
        .filter((o) => o.orderStatus === 'DELIVERED')
        .forEach((o) =>
            (o.items || []).forEach((it) => {
                const pid = String(it.productId?._id || it.productId || it.product?._id || '');
                if (pid) counts.set(pid, (counts.get(pid) || 0) + (it.quantity || 1));
            }),
        );
    return available.filter((p) => counts.has(String(p._id))).sort((a, b) => counts.get(String(b._id)) - counts.get(String(a._id)));
};

/** Categories ranked by how much of them sells (sum of soldCount / reviewCount over in-stock items). */
const topAisles = (available, categories, count, min) => {
    const groups = new Map();
    available.forEach((p) => {
        const id = String(productCategoryId(p));
        if (!groups.has(id)) groups.set(id, { id, products: [], score: 0 });
        const g = groups.get(id);
        g.products.push(p);
        g.score += popularity(p);
    });
    return Array.from(groups.values())
        .filter((g) => g.products.length >= min)
        .map((g) => ({ ...g, category: categories.find((c) => String(idOf(c)) === g.id) || null }))
        .filter((g) => g.category)
        .sort((a, b) => b.score - a.score || b.products.length - a.products.length)
        .slice(0, count)
        .map((g) => ({ ...g, products: g.products.sort(byPopularity) }));
};

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * buildHomeSections({ products, categories, orders, now, language, t }) → section descriptors.
 * Each descriptor carries its data plus translated, mixed-weight title parts. Renderers live in
 * HomeScreen / EditorialSections; this stays pure so it is easy to test and reorder.
 */
export function buildHomeSections({ products = [], categories = [], orders = [], now = new Date(), language = 'en', t, eta = 10 }) {
    const tr = (key, vars) => fmt(t(key), vars);
    const title = (key, vars) => ({ lead: tr(`${key}.lead`, vars), emphasis: tr(`${key}.emphasis`, vars), trail: optional(t, `${key}.trail`, vars) });
    const count = (n) => tr(n === 1 ? 'homeFeed.itemOne' : 'homeFeed.items', { n });

    const available = products.filter(isAvailable);
    const out = [];

    SECTION_ORDER.forEach((cfg) => {
        switch (cfg.type) {
            case 'banners':
                out.push({ key: cfg.id, type: 'banners' });
                break;

            case 'moment': {
                const moment = momentFor(now);
                const list = collect(available, moment, cfg.limit);
                if (list.length < cfg.min) break;
                out.push({
                    key: `moment-${moment.id}`,
                    type: 'moment',
                    moment: moment.id,
                    eyebrow: t(moment.eyebrowKey),
                    ...title(moment.titleKey, { eta }),
                    subtitle: tr('homeFeed.momentCount', { n: list.length }),
                    products: list,
                });
                break;
            }

            case 'rail': {
                if (cfg.source === 'orders') {
                    if (!orders.length) break;
                    const list = buyAgain(available, orders).slice(0, cfg.limit);
                    if (list.length < cfg.min) break;
                    out.push({ key: cfg.id, type: 'rail', ...title('homeFeed.buyAgain'), subtitle: t('homeFeed.buyAgain.subtitle'), products: list });
                } else if (cfg.source === 'discount') {
                    const list = available
                        .filter((p) => discountOf(p) >= cfg.minDiscount)
                        .sort((a, b) => discountOf(b) - discountOf(a) || byPopularity(a, b))
                        .slice(0, cfg.limit);
                    if (list.length < cfg.min) break;
                    out.push({
                        key: cfg.id,
                        type: 'rail',
                        ...title('homeFeed.deals'),
                        subtitle: tr('homeFeed.deals.subtitle', { n: discountOf(list[0]) }),
                        products: list,
                    });
                }
                break;
            }

            case 'grid':
                if (categories.length) out.push({ key: cfg.id, type: 'grid', categories: categories.slice(0, cfg.limit) });
                break;

            case 'priceStore': {
                const stores = PRICE_STORES.map((max) => ({
                    max,
                    label: tr('homeFeed.priceStore.under', { p: max }),
                    products: available.filter((p) => Number(p.price) > 0 && Number(p.price) <= max).sort(byPopularity).slice(0, cfg.limit),
                })).filter((s) => s.products.length >= cfg.min);
                if (!stores.length) break;
                out.push({
                    key: cfg.id,
                    type: 'priceStore',
                    ...title('homeFeed.priceStore'),
                    stores: stores.map((s) => ({ ...s, caption: count(s.products.length) })),
                });
                break;
            }

            case 'fresh': {
                const produce = available.filter((p) => p.isPerishable !== false && isProduce(p)).sort(byPopularity);
                if (produce.length < cfg.min) break;
                const n = Math.min(cfg.limit, produce.length);
                const tiles = produce.slice(0, n - (n % 2)); // whole rows of two
                const category = categories.find((c) => String(idOf(c)) === String(productCategoryId(tiles[0]))) || null;
                out.push({
                    key: cfg.id,
                    type: 'fresh',
                    ...title('homeFeed.fresh'),
                    subtitle: tr('homeFeed.fresh.subtitle', { n: produce.length }),
                    products: tiles.map((p) => ({ product: p, freshness: freshnessOf(p) })),
                    category,
                });
                break;
            }

            case 'season': {
                const used = new Set(out.flatMap((s) => (s.type === 'moment' ? s.products.map((p) => String(p._id)) : [])));
                const season = seasonsFor(now)
                    .map((s) => {
                        const all = collect(available, s, 50);
                        // prefer products the moment card didn't already show; fall back to all
                        const fresh = all.filter((p) => !used.has(String(p._id)));
                        return { s, list: (fresh.length >= cfg.min ? fresh : all).slice(0, cfg.limit) };
                    })
                    .find(({ list }) => list.length >= cfg.min);
                if (!season) break;
                out.push({
                    key: `season-${season.s.id}`,
                    type: 'season',
                    season: season.s.id,
                    eyebrow: t(`${season.s.titleKey}.eyebrow`),
                    ...title(season.s.titleKey),
                    subtitle: tr(`${season.s.titleKey}.subtitle`, { n: season.list.length }),
                    products: season.list,
                });
                break;
            }

            case 'aisles':
                topAisles(available, categories, cfg.count, cfg.min).forEach((g) => {
                    out.push({
                        key: `aisle-${g.id}`,
                        type: 'rail',
                        title: nameOf(g.category, language),
                        subtitle: count(g.products.length),
                        products: g.products.slice(0, cfg.limit),
                        category: g.category,
                    });
                });
                break;

            default:
                break;
        }
    });
    return out;
}

/** "{n} items" → "12 items". */
export const fmt = (str, vars) => (vars && typeof str === 'string' ? str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)) : str);

/** t() returns the key itself when missing; treat that as "no trail". */
const optional = (t, key, vars) => {
    const v = t(key);
    return v && v !== key ? fmt(v, vars) : undefined;
};
