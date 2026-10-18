/**
 * Real catalogue pictures for onboarding and login.
 *
 *   useCatalogPreview(count) -> { tiles, products, ready }
 *     tiles     `count` pictures: { key, uri, cutout } (a product picture; `cutout` only when we know
 *               it has no background) or { key, asset, cutout: true } (a bundled still life / produce
 *               icon when the catalogue is offline). Empty array until ready.
 *     products  the products with a picture and a price (name, unit, price, image), for the welcome
 *               product card and the packing card. Empty when the catalogue could not be reached.
 *     ready     false while the first request is in flight (at most FALLBACK_AFTER_MS)
 *   markBroken(uri)  a picture failed to load: it leaves every collage and the rest close the gap.
 *
 * GET /products is public. The answer is kept for the session, so Login reuses Onboarding's pictures
 * without a second request. A slow catalogue never blocks: after FALLBACK_AFTER_MS the bundled set is
 * used.
 */
import { useEffect, useState } from 'react';
import { ProductService } from '../../services';
import { ICONS_3D } from '../../components/ui';

const FALLBACK_AFTER_MS = 2500;

const STILL_LIFES = [
    require('../../assets/onboarding/daily-vegetables.webp'),
    require('../../assets/onboarding/fruit-and-eggs.webp'),
    require('../../assets/onboarding/kitchen-basics.webp'),
];

// Produce and staples only: things a kirana actually sells.
const PRODUCE = [
    'tomato', 'leafy_green', 'banana', 'glass_of_milk', 'carrot', 'egg', 'bread', 'red_apple',
    'cheese_wedge', 'mango', 'sheaf_of_rice', 'honey_pot', 'coconut', 'hot_pepper', 'cookie', 'jar',
];

/** A bundled picture for tile `i`: a still life every fifth tile, a produce icon otherwise. */
export function fallbackFor(i) {
    if (i % 5 === 2) {
        return { key: `still-${i}`, asset: STILL_LIFES[Math.floor(i / 5) % STILL_LIFES.length], cutout: true };
    }
    return { key: `icon-${i}`, asset: ICONS_3D[PRODUCE[i % PRODUCE.length]], icon: true, cutout: true };
}

// Any picture the catalogue normaliser accepted (remote, bundled '/assets/…' or data URI), but not a
// generated text placeholder.
const isPhoto = (uri) => typeof uri === 'string' && uri.length > 0 && !/placehold|dummyimage|via\.placeholder/i.test(uri);

let cache = null; // products with a photo, once known
let pending = null;

function load() {
    if (cache) return Promise.resolve(cache);
    if (!pending) {
        pending = ProductService.getProducts({ limit: 24 })
            .then((page) => {
                const seen = new Set();
                cache = (page?.products || []).filter((p) => {
                    const uri = p?.image || p?.images?.[0];
                    if (!isPhoto(uri) || seen.has(uri)) return false;
                    seen.add(uri);
                    return true;
                });
                return cache;
            })
            .catch(() => {
                pending = null; // try again on the next mount
                return [];
            });
    }
    return pending;
}

// Pictures we know have no background: the backend's processed cut-outs (`imageProcessed`) and
// bundled assets (served from the app itself). Everything else is treated as a photo that may
// have a white background (FloatingProduct then draws it as a sticker where that would show).
const isCutout = (p, uri) => p?.imageProcessed === true || /^\/assets\/|^file:|^asset:|\/assets\/\?unstable_path=/.test(uri);

// Pictures that failed to load this session: dropped from every collage, the rest close the gap.
const broken = new Set();
const brokenListeners = new Set();
export function markBroken(uri) {
    if (!uri || broken.has(uri)) return;
    broken.add(uri);
    brokenListeners.forEach((fn) => fn());
}

const imageOf = (p) => p?.image || p?.images?.[0];

/** A FloatingProduct source for a catalogue product (null when it has no usable picture). */
export const sourceFor = (p) => {
    const uri = imageOf(p);
    return uri && !broken.has(uri) ? { key: uri, uri, cutout: isCutout(p, uri) } : null;
};

const build = (all, count) => {
    const products = all.filter((p) => !broken.has(imageOf(p)));
    return {
        ready: true,
        products: products.filter((p) => p.price > 0 && p.isAvailable !== false),
        // real photos repeat before any bundled picture is mixed in; bundled ones only when offline
        tiles: Array.from({ length: count }, (_, i) => {
            const p = products.length ? products[i % products.length] : null;
            const uri = imageOf(p);
            return uri ? { key: `${uri}#${i}`, uri, cutout: isCutout(p, uri) } : fallbackFor(i);
        }),
    };
};

const EMPTY = { ready: false, products: [], tiles: [] };

export function useCatalogPreview(count) {
    const [all, setAll] = useState(() => cache); // null until the catalogue (or the fallback) answers
    const [, setTick] = useState(0);
    useEffect(() => {
        const fn = () => setTick((n) => n + 1);
        brokenListeners.add(fn);
        return () => brokenListeners.delete(fn);
    }, []);
    useEffect(() => {
        if (all) return undefined;
        let live = true;
        const timer = setTimeout(() => {
            if (live) setAll((cur) => cur || []);
        }, FALLBACK_AFTER_MS);
        load().then((products) => {
            if (live) setAll((cur) => (cur && cur.length ? cur : products));
        });
        return () => {
            live = false;
            clearTimeout(timer);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return all ? build(all, count) : EMPTY;
}

/** A pack size worth showing ("500 ml", "6 pcs"), or '' for junk like "1pc" or multi-line values. */
export const packLabel = (p) => {
    const u = String(p?.pack?.unit || p?.unit || '').trim();
    return u && u.length <= 16 && !/[\r\n]/.test(u) && !/^1\s?pc$/i.test(u) ? u : '';
};

/** The product's name in the active language (falls back to the catalogue name). */
export const productName = (p, isHi) => (isHi && (p?.nameHi || p?.translatedName)) || p?.name || '';

export default useCatalogPreview;
