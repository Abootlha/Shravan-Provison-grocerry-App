/**
 * useSearchCatalog — the slice of the real catalogue that search needs before anything is typed:
 *
 *   products     GET /products?limit=100 (the API sorts by soldCount; we sort again to be safe)
 *   popular      in-stock products, best sellers first ("Popular right now")
 *   vocabulary   words from product / category / subcategory names (typo correction, suggestions)
 *   names        short in-stock product names for the rotating search hint ("Amul Malai Paneer")
 *   byId         Map id → product (Buy again lookups)
 *
 * One request, shared by every caller (requestCache in ProductService), so Home's search bar and
 * the Search screen don't fetch twice. Nothing is invented: empty lists until the API answers.
 */
import { useEffect, useMemo, useState } from 'react';
import { ProductService } from '../../services/services';
import { getProductId, isInStock } from '../../components/product/productUtils';
import { buildVocabulary } from './searchSynonyms';

let cache = null;
let pending = null;

const load = () => {
    if (!pending) {
        pending = ProductService.getProducts({ limit: 100 })
            .then((page) => {
                cache = Array.isArray(page?.products) ? page.products : [];
                return cache;
            })
            .catch(() => [])
            .finally(() => {
                pending = null;
            });
    }
    return pending;
};

const sold = (p) => Number(p.soldCount) || 0;
/** "Fresh Tomato (Hybrid)" → "Fresh Tomato"; long names keep their first three words. */
const shortName = (name) => {
    const s = String(name || '').replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const words = s.split(/\s+/);
    return words.length > 3 ? words.slice(0, 3).join(' ') : s;
};

export default function useSearchCatalog({ isHi = false } = {}) {
    const [products, setProducts] = useState(cache || []);
    useEffect(() => {
        let alive = true;
        // refresh on every mount (stock changes); the last answer paints first
        load().then((list) => alive && list.length && setProducts(list));
        return () => {
            alive = false;
        };
    }, []);

    return useMemo(() => {
        const sorted = [...products].sort((a, b) => sold(b) - sold(a));
        const popular = sorted.filter(isInStock);
        const names = [];
        popular.forEach((p) => {
            const n = shortName((isHi && p.nameHi) || p.name);
            if (n && !names.includes(n)) names.push(n);
        });
        const vocabulary = buildVocabulary(
            products.flatMap((p) => [p.name, p.brand, p.categoryId?.name, p.subcategoryId?.name].filter((x) => typeof x === 'string')),
        );
        const byId = new Map(products.map((p) => [String(getProductId(p)), p]));
        return { products: sorted, popular, names, vocabulary, byId, loaded: products.length > 0 };
    }, [products, isHi]);
}

// The rotating search hint continues where the last screen left it: each mount starts on the next
// product name and changes once (no endless loop, DESIGN.md "Motion").
let hintCursor = 0;
export const takeHintStart = () => hintCursor++;
export const noteHintIndex = (i) => {
    hintCursor = Math.max(hintCursor, i + 1);
};
