/**
 * Shared product helpers for cards, PDP, search and wishlist.
 * API products (Nest `products` module) carry `_id`, `pricing`, `pack`, `images`, `stock`,
 * `isAvailable`; card-shaped products (Home/Category mappers, wishlist, cart) carry `id`,
 * `price`, `originalPrice`, `unit`, `image`, `inStock`, `discount`. Everything here accepts both.
 */
import { themes } from '../../constants/theme';

export const getProductId = (p) => (p ? p.id || p._id || p.productId : undefined);

export const getCategoryId = (p) => {
    const c = p?.categoryId;
    return c && typeof c === 'object' ? c._id || c.id : c;
};

// Positive values win: an unpriced legacy `price: 0` falls through to `pricing`.
export const getPrice = (p) => Number(p?.price) || Number(p?.pricing?.sellingPrice) || 0;
export const getMrp = (p) => Number(p?.originalPrice) || Number(p?.pricing?.mrp) || 0;
const cleanLabel = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
/**
 * Pack label. The structured `pack.unit` wins when it reads as a real measure ("100 g") and the
 * legacy `unit` doesn't ("1pc"); otherwise the legacy field, as before.
 */
export const getUnit = (p) => {
    const legacy = cleanLabel(p?.unit);
    const pack = cleanLabel(p?.pack?.unit);
    const old = parsePack(legacy);
    const vague = !old || (old.kind === 'count' && old.amount <= 1);
    if (pack && pack !== legacy && parsePack(pack) && vague) return pack;
    return legacy || pack || cleanLabel(p?.packSize) || '';
};
export const getImage = (p) => p?.image || (Array.isArray(p?.images) ? p.images[0] : undefined);

export const getImages = (p) => {
    const list = Array.isArray(p?.images) ? p.images.filter(Boolean) : [];
    if (list.length) return list;
    const one = getImage(p);
    return one ? [one] : [];
};

export const isInStock = (p) => {
    if (!p) return false;
    if (typeof p.inStock === 'boolean') return p.inStock;
    if (p.isAvailable === false) return false;
    if (typeof p.stock === 'number') return p.stock > 0;
    return true;
};

export const getDiscountPercent = (p) => {
    const price = getPrice(p);
    const mrp = getMrp(p);
    if (mrp > price && mrp > 0) return Math.round(((mrp - price) / mrp) * 100);
    return Number(p?.discount) > 0 ? Math.round(Number(p.discount)) : 0;
};

/** Units in stock (product or default variant), or null when the record doesn't say. */
export const getStock = (p) => {
    if (!p) return null;
    const n = Number(p.stock);
    return p.stock != null && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
};

export const getSubcategoryId = (p) => {
    const s = p?.subcategoryId;
    return s && typeof s === 'object' ? s._id || s.id : s || null;
};

/** Active variants (pack sizes). A product "has options" when there is more than one. */
export const activeVariants = (p) => (Array.isArray(p?.variants) ? p.variants.filter((v) => v && v.isActive !== false && v.unit) : []);

/**
 * Freshness facts the record actually carries: chilled storage, or a short shelf life (2 days or
 * less, so it isn't repeated on every vegetable). Null when there's nothing worth saying.
 */
export const freshnessOf = (p) => {
    const storage = p?.attributes?.storage || p?.storage;
    if (/refrigerat|chill|frozen/i.test(storage || '')) return { kind: /frozen/i.test(storage) ? 'frozen' : 'chilled' };
    const days = Number(p?.shelfLife);
    if (p?.isPerishable && days > 0 && days <= 2) return { kind: 'shelf', days };
    return null;
};

/** Normalises an API product into the card shape the cart + wishlist store. */
export const normalizeProduct = (p, displayName) => {
    const price = getPrice(p);
    const originalPrice = getMrp(p);
    return {
        id: getProductId(p),
        name: displayName || p?.translatedName || p?.name || '',
        price,
        originalPrice,
        unit: getUnit(p),
        image: getImage(p),
        categoryId: getCategoryId(p),
        inStock: isInStock(p),
        discount: getDiscountPercent(p),
        stock: getStock(p),
        options: activeVariants(p).length,
        // raw pack sizes only when there is a choice (the variant sheet reads them)
        variants: activeVariants(p).length > 1 ? activeVariants(p) : undefined,
        freshness: p?.freshness !== undefined ? p.freshness : freshnessOf(p),
    };
};

// ---------------------------------------------------------------------------
// Pack size + unit price
// ---------------------------------------------------------------------------

const UNIT_RE = /(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gms|gram|grams|l|ltr|litre|liter|ml)\b/i;
const PIECES_RE = /^\s*(\d+)\s*(pcs|pc|pieces|piece|pack|packs|nos|units?)\b/i;
const MULTI_RE = /^\s*(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|gm|l|ltr|ml)\b/i;

/**
 * Reads a pack label into a measure: { kind: 'weight' (grams) | 'volume' (ml) | 'count', amount }.
 * "500 g", "1 L", "4 x 70 g", "6 pcs", "4 pcs (approx. 550 g)" (sold by count). Null when unreadable.
 */
export const parsePack = (label) => {
    const s = String(label || '').trim();
    if (!s) return null;
    const pieces = s.match(PIECES_RE);
    if (pieces) return { kind: 'count', amount: Number(pieces[1]) };
    const multi = s.match(MULTI_RE);
    const one = multi ? null : s.match(UNIT_RE);
    const m = multi ? [null, multi[2], multi[3]] : one;
    if (!m) return null;
    const n = Number(m[1]) * (multi ? Number(multi[1]) : 1);
    const u = m[2].toLowerCase();
    // a pack over 50 kg / 50 L is a data-entry slip (e.g. a barcode in the unit field), not a size
    if (!(n > 0) || n > (u.startsWith('kg') ? 50 : u.startsWith('g') ? 50000 : u === 'ml' ? 50000 : 50)) return null;
    if (u.startsWith('kg')) return { kind: 'weight', amount: n * 1000 };
    if (u.startsWith('g')) return { kind: 'weight', amount: n };
    if (u === 'ml') return { kind: 'volume', amount: n };
    return { kind: 'volume', amount: n * 1000 };
};

const trimNum = (n) => (n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(/\.0$/, ''));

/**
 * "₹58/kg", "₹12/100 g", "₹8/pc" — only when it tells the shopper something: hidden for a single
 * piece and for packs that already are the base unit (1 kg, 1 L, 100 g, 100 ml). Null otherwise.
 */
export const unitPriceLabel = (price, label, isHi = false) => {
    const pack = parsePack(label);
    const p = Number(price);
    if (!pack || !(p > 0)) return null;
    if (pack.kind === 'count') {
        if (pack.amount <= 1) return null;
        return `₹${trimNum(p / pack.amount)}/${isHi ? 'पीस' : 'pc'}`;
    }
    const big = pack.amount >= 500;
    const base = big ? 1000 : 100;
    if (pack.amount === base) return null;
    const unit = pack.kind === 'weight' ? (big ? 'kg' : '100 g') : big ? 'L' : '100 ml';
    return `₹${trimNum((p / pack.amount) * base)}/${unit}`;
};

/** Pack label for a narrow card: "4 pcs (approx. 550 g)" → "4 pcs · ~550 g"; Hindi pieces → पीस. */
export const shortPackLabel = (label, isHi = false) => {
    let s = String(label || '').trim();
    s = s.replace(/\s*\((?:approx\.?|approximately|about)\s*([^)]+)\)/i, ' · ~$1');
    if (isHi) s = s.replace(/\bpcs\b|\bpc\b|\bpieces\b/gi, 'पीस');
    return s;
};

/** Smallest discount worth a tag: a ₹2-off-₹56 milk shouldn't outrank "Keep chilled". */
export const DISCOUNT_TAG_MIN_PERCENT = 5;

/**
 * The ONE tag a product card shows on its image well (null for none). Rules, in order:
 *   sold out → no tag (the card itself is greyed and offers "Notify me")
 *   discount ≥ 5% → "₹11 off"
 *   chilled / frozen storage, or shelf life ≤ 2 days → freshness tag
 */
export const cardTagOf = (p) => {
    if (!p || p.inStock === false) return null;
    const price = Number(p.price) || getPrice(p);
    const mrp = Number(p.originalPrice) || getMrp(p);
    if (mrp > price && price > 0 && ((mrp - price) / mrp) * 100 >= DISCOUNT_TAG_MIN_PERCENT) {
        return { kind: 'discount', amount: Math.round(mrp - price) };
    }
    const fresh = p.freshness !== undefined ? p.freshness : freshnessOf(p);
    return fresh ? { kind: fresh.kind, days: fresh.days } : null;
};

/** Indian digit grouping: 123456 → "1,23,456". */
export const formatINR = (n) => {
    const v = Math.round(Number(n) || 0);
    const s = String(Math.abs(v));
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
    return `${v < 0 ? '-' : ''}${grouped}`;
};

/**
 * Tile colours for a product's image well. DESIGN.md removed the pastel category tints: every
 * well is the neutral image well with ink. Pass the active palette (`useTheme().colors`).
 */
// eslint-disable-next-line no-unused-vars
export const tintForCategory = (categoryId, colors = themes.light.colors) => ({ bg: colors.imageWell, ink: colors.inkSecondary });

// ---------------------------------------------------------------------------
// Pack-size variants in the cart
// ---------------------------------------------------------------------------

/** The variant the product's own price / unit / stock mirror (isDefault, else the first). */
export const defaultVariantOf = (p) => {
    const all = Array.isArray(p?.variants) ? p.variants : [];
    return all.find((v) => v?.isDefault) || all[0] || null;
};

/**
 * Cart line for one pack size. The default pack keeps the product id as its line id (so the
 * product card's stepper and the cart agree); other packs get `${productId}::${sku}`. Every
 * variant line carries productId + variantSku, which the quote and the order send.
 */
export const variantLineOf = (product, variant, cartName) => {
    const productId = getProductId(product);
    const def = defaultVariantOf(product);
    const isDefault = !!def && def.sku === variant.sku;
    return {
        id: isDefault ? productId : `${productId}::${variant.sku}`,
        productId,
        variantSku: variant.sku,
        name: cartName || product.name,
        image: getImage(product),
        unit: variant.unit,
        price: Number(variant.sellingPrice) || 0,
        originalPrice: Number(variant.mrp) || 0,
        stock: Math.max(0, Number(variant.stock) || 0),
        inStock: Number(variant.stock) > 0,
        categoryId: getCategoryId(product),
    };
};
