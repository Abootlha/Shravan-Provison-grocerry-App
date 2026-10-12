/**
 * One place that turns catalogue API responses into the shapes the screens use.
 *
 * The backend (backend/src/modules/{products,categories,subcategories}) has carried several
 * shapes over time: prices in `price`/`originalPrice`, in `pricing.{sellingPrice,mrp}` or only on
 * the default variant; the pack size in `unit` or `pack.unit`; the picture in `image` or
 * `images[0]`; populated or bare `categoryId` / `subcategoryId` / `parentId`. Screens get one shape:
 *
 *   product      { ...raw, _id, id, name, price, originalPrice, unit, image, images, stock,
 *                  isAvailable, categoryId, subcategoryId }   (category/subcategory stay populated
 *                  objects when the API populated them, otherwise the id string)
 *   category     { ...raw, _id, id, name, icon, image }       (inactive ones dropped)
 *   subcategory  { ...raw, _id, id, name, parentId: '<id>', parent }
 *
 * List readers throw an `UnexpectedResponseError` when the body is not the expected JSON (an HTML
 * page from a wrong API_BASE_URL, a proxy error page, ...) instead of quietly returning [].
 */

export class UnexpectedResponseError extends Error {
    constructor(what, body) {
        const kind = body == null ? String(body) : Array.isArray(body) ? 'array' : typeof body;
        const preview = typeof body === 'string' ? `: ${body.slice(0, 80).replace(/\s+/g, ' ')}` : '';
        super(`Unexpected response for ${what} (got ${kind}${preview})`);
        this.name = 'UnexpectedResponseError';
    }
}

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const firstPositive = (...vals) => {
    for (const v of vals) {
        const n = num(v);
        if (n != null && n > 0) return n;
    }
    return 0;
};
const str = (v) => (v == null ? '' : String(v));

/** `_id` of a populated ref or the ref itself. */
export const refId = (v) => {
    if (!v) return null;
    if (typeof v === 'object') return v._id != null ? String(v._id) : v.id != null ? String(v.id) : null;
    return String(v);
};

/** A populated ref keeps its object (with a string `_id`); a bare ref becomes its id string. */
const ref = (v) => {
    if (!v) return v ?? null;
    if (typeof v === 'object') {
        const id = refId(v);
        return id ? { ...v, _id: id } : null;
    }
    return String(v);
};

const isImageUrl = (v) => typeof v === 'string' && (/^https?:\/\//.test(v) || v.startsWith('data:image/') || v.startsWith('file:') || v.startsWith('/'));

/** Read `body[key]` as a list. Accepts a bare array and a `{ data: { key } }` envelope. */
export const listFrom = (body, key, what = key) => {
    if (Array.isArray(body)) return body;
    if (body && typeof body === 'object') {
        if (Array.isArray(body[key])) return body[key];
        if (body.data && typeof body.data === 'object') {
            if (Array.isArray(body.data[key])) return body.data[key];
            if (Array.isArray(body.data)) return body.data;
        }
    }
    throw new UnexpectedResponseError(what, body);
};

export const normalizeProduct = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const id = refId(raw._id ?? raw.id);
    if (!id) return null;
    const variants = Array.isArray(raw.variants) ? raw.variants.filter((v) => v && v.isActive !== false) : [];
    const variant = variants.find((v) => v.isDefault) || variants[0] || null;
    const price = firstPositive(raw.price, raw.pricing?.sellingPrice, raw.sellingPrice, variant?.sellingPrice);
    const mrp = firstPositive(raw.originalPrice, raw.pricing?.mrp, raw.mrp, variant?.mrp);
    const images = (Array.isArray(raw.images) ? raw.images : []).filter(isImageUrl);
    const image = isImageUrl(raw.image) ? raw.image : images[0] || '';
    const stockRaw = num(raw.stock ?? variant?.stock);
    return {
        ...raw,
        _id: id,
        id,
        name: str(raw.name).trim(),
        price,
        originalPrice: mrp > price ? mrp : price,
        unit: str(raw.unit || raw.pack?.unit || variant?.unit || raw.packSize).trim(),
        image,
        images: images.length ? images : image ? [image] : [],
        stock: stockRaw == null ? null : stockRaw,
        // An item without a selling price can't be ordered: show it, but as unavailable.
        isAvailable: raw.isAvailable !== false && price > 0,
        categoryId: ref(raw.categoryId),
        subcategoryId: ref(raw.subcategoryId),
        soldCount: num(raw.soldCount) || 0,
        reviewCount: num(raw.reviewCount) || 0,
        rating: num(raw.rating) || 0,
    };
};

export const normalizeCategory = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const id = refId(raw._id ?? raw.id);
    if (!id || !raw.name) return null;
    return {
        ...raw,
        _id: id,
        id,
        name: str(raw.name).trim(),
        icon: typeof raw.icon === 'string' ? raw.icon : '',
        image: isImageUrl(raw.image) ? raw.image : isImageUrl(raw.icon) ? raw.icon : '',
        isActive: raw.isActive !== false,
        sortOrder: num(raw.sortOrder) || 0,
    };
};

export const normalizeSubcategory = (raw) => {
    const c = normalizeCategory(raw);
    if (!c) return null;
    const parent = raw.parentId && typeof raw.parentId === 'object' ? normalizeCategory(raw.parentId) : null;
    return { ...c, parentId: refId(raw.parentId), parent };
};

const compact = (list, fn) => list.map(fn).filter(Boolean);

export const normalizeProducts = (list) => compact(list, normalizeProduct);
export const normalizeCategories = (list) => compact(list, normalizeCategory).filter((c) => c.isActive);
export const normalizeSubcategories = (list) => compact(list, normalizeSubcategory).filter((c) => c.isActive);

/** GET /products body → `{ products, total, page, limit, totalPages }` with normalised products. */
export const normalizeProductPage = (body, what = 'GET /products') => {
    const products = normalizeProducts(listFrom(body, 'products', what));
    const meta = body && !Array.isArray(body) && typeof body === 'object' ? body : {};
    return {
        ...meta,
        products,
        total: num(meta.total) ?? products.length,
    };
};

/** Short human description of a failed request, for dev diagnostics. */
export const describeError = (err) => {
    if (!err) return '';
    const status = err.response?.status;
    const url = err.config ? `${err.config.baseURL || ''}${err.config.url || ''}` : '';
    return [status ? `HTTP ${status}` : err.code || err.name, err.message, url].filter(Boolean).join(' · ');
};

/**
 * Customer-facing copy for a failed request. Never shows codes, URLs or stack text; the
 * technical detail belongs in the __DEV__ console (describeError).
 */
export const friendlyError = (err, isHi = false) => {
    const status = err?.response?.status;
    const code = err?.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
        return isHi ? 'स्टोर जवाब देने में समय ले रहा है। फिर से कोशिश करें।' : 'The store is taking too long to answer. Try again.';
    }
    if (!status && (code === 'ERR_NETWORK' || err?.isAxiosError || err?.request)) {
        return isHi
            ? 'अभी स्टोर तक नहीं पहुँच पा रहे हैं। अपना इंटरनेट कनेक्शन जाँचें।'
            : 'Can’t reach the store right now. Check your connection.';
    }
    if (!status) return isHi ? 'कुछ गड़बड़ हो गई। फिर से कोशिश करें।' : 'Something went wrong. Try again.';
    if (status === 404) return isHi ? 'यह अब उपलब्ध नहीं है।' : 'This isn’t available any more.';
    if (status === 429) return isHi ? 'बहुत सारे अनुरोध। थोड़ी देर बाद कोशिश करें।' : 'Too many tries. Wait a moment and try again.';
    if (status >= 500) {
        return isHi ? 'हमारी तरफ़ से कुछ गड़बड़ हुई। थोड़ी देर में फिर कोशिश करें।' : 'Something went wrong on our side. Try again in a moment.';
    }
    return isHi ? 'कुछ गड़बड़ हो गई। फिर से कोशिश करें।' : 'Something went wrong. Try again.';
};
