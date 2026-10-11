/**
 * Shared product helpers for cards, PDP, search and wishlist.
 * API products (Nest `products` module) carry `_id`, `pricing`, `pack`, `images`, `stock`,
 * `isAvailable`; card-shaped products (Home/Category mappers, wishlist, cart) carry `id`,
 * `price`, `originalPrice`, `unit`, `image`, `inStock`, `discount`. Everything here accepts both.
 */
import { themes } from '../../constants/theme';

/** Backend orders.service: deliveryFee = itemTotal >= 200 ? 0 : 25 */
export const FREE_DELIVERY_THRESHOLD = 200;

export const getProductId = (p) => (p ? p.id || p._id || p.productId : undefined);

export const getCategoryId = (p) => {
    const c = p?.categoryId;
    return c && typeof c === 'object' ? c._id || c.id : c;
};

export const getPrice = (p) => Number(p?.price ?? p?.pricing?.sellingPrice) || 0;
export const getMrp = (p) => Number(p?.originalPrice ?? p?.pricing?.mrp) || 0;
export const getUnit = (p) => p?.unit || p?.pack?.unit || p?.packSize || '';
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
    };
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
