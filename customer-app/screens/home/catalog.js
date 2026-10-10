/**
 * Catalog helpers shared by Home, Categories and the Category listing.
 * Pure functions only: id/name resolution, ProductCard mapping and the
 * header theme lookup.
 */
import { themes } from '../../constants/theme';

export const idOf = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    return obj._id || obj.id || null;
};

export const nameOf = (item, currentLanguage) =>
    (currentLanguage === 'hi' && item?.translatedName ? item.translatedName : item?.name) || '';

export const isImageUri = (v) => typeof v === 'string' && (/^https?:\/\//.test(v) || (v.startsWith('data:image/') && v.length < 100000));

/** Remote image for a category/subcategory, if any (backend may store a URL in `icon`). */
export const imageOf = (item) => {
    if (isImageUri(item?.image)) return item.image;
    if (isImageUri(item?.icon)) return item.icon;
    return null;
};

/** MaterialCommunityIcons glyph name, if the record carries one. */
export const glyphOf = (item, fallback = 'basket-outline') =>
    typeof item?.icon === 'string' && item.icon && !isImageUri(item.icon) && !item.icon.startsWith('data:') ? item.icon : fallback;

export const discountOf = (p) => {
    const price = Number(p?.price) || 0;
    const mrp = Number(p?.originalPrice) || 0;
    return mrp > price ? Math.round((1 - price / mrp) * 100) : 0;
};

/** API product -> the `product` prop ProductCard expects (unchanged contract). */
export const toCardProduct = (item, currentLanguage) => ({
    id: item._id,
    name: nameOf(item, currentLanguage),
    price: item.price,
    originalPrice: item.originalPrice,
    unit: item.unit,
    image: item.image,
    categoryId: item.categoryId?._id || item.categoryId,
    inStock: item.isAvailable && item.stock > 0,
    discount: discountOf(item),
});

// ---------------------------------------------------------------------------
// Header theme per category
// ---------------------------------------------------------------------------

/**
 * Header theme for a category. DESIGN.md removed the per-category re-tint: every category gets the
 * plain surface header, and the selected tab's violet underline is the only state colour. Kept as a
 * function so callers don't change. `t` is the active theme (useTheme()); defaults to light.
 */
// eslint-disable-next-line no-unused-vars
export const headerThemeFor = (category, index = 0, t = themes.light) => t.headerThemes.default;

// ---------------------------------------------------------------------------
// Category grouping (Categories tab)
// ---------------------------------------------------------------------------

const GROUP_RULES = [
    [0, /fruit|veg|dairy|bread|egg|atta|rice|dal|masala|oil|spice|bakery|frozen|instant|meat|kitchen/i],
    [1, /snack|munch|drink|juice|tea|coffee|sweet|chocolate|ice ?cream|biscuit/i],
    [2, /clean|personal|care|baby|home|beauty|pet|pharma|health/i],
];

/** Index into CATEGORY_GROUPS for a category (uses `group` when the record has one). */
export const groupIndexOf = (category, groups) => {
    if (category?.group) {
        const i = groups.indexOf(category.group);
        if (i >= 0) return i;
    }
    const hit = GROUP_RULES.find(([, re]) => re.test(category?.name || ''));
    return hit ? hit[0] : groups.length; // groups.length => "More"
};
