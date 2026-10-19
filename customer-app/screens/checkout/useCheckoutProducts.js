import { useEffect, useMemo, useRef, useState } from 'react';
import { ProductService } from '../../services';

const productId = (p) => String(p?._id || p?.id || '');
const orderable = (p) => p && p.isAvailable !== false && (p.stock == null || p.stock > 0) && Number(p.price) > 0;

/**
 * In-stock catalogue products for checkout (one request, shared by the suggestions rail and the
 * free-delivery rail). `products` is null while loading.
 */
export function useCheckoutProducts() {
    const [products, setProducts] = useState(null);
    useEffect(() => {
        let alive = true;
        ProductService.getProducts({ limit: 24 })
            .then((res) => { if (alive) setProducts((res?.products || []).filter(orderable)); })
            .catch(() => { if (alive) setProducts([]); });
        return () => { alive = false; };
    }, []);
    return products;
}

/**
 * Products that close the free-delivery gap: those priced at or above the gap first (cheapest
 * first), then the closest ones below it. Real catalogue items only, minus `excludeIds` (the cart
 * as it was when checkout opened, so an item added from the rail stays and shows its stepper).
 * The list is picked once per catalogue load, so it doesn't reshuffle as the gap shrinks.
 */
export function useGapFillers(products, excludeIds, gap, max = 8) {
    const gapRef = useRef(gap);
    gapRef.current = gap;
    return useMemo(() => {
        const g = gapRef.current;
        if (!products?.length || !(g > 0)) return [];
        const pool = products.filter((p) => !excludeIds.has(productId(p)));
        const closes = pool.filter((p) => p.price >= g).sort((a, b) => a.price - b.price);
        const near = pool.filter((p) => p.price < g).sort((a, b) => b.price - a.price);
        return [...closes, ...near].slice(0, max);
    }, [products, excludeIds, max, gap > 0]); // eslint-disable-line react-hooks/exhaustive-deps
}

export { productId };
