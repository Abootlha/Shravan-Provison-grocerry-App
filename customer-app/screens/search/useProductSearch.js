/**
 * useProductSearch — debounced (250 ms) product search against GET /products?search=
 * (same endpoint as ProductService.searchProducts). Each new query aborts the in-flight
 * request and stale responses are ignored. Hindi names are translated like Home/Category.
 */
import { useEffect, useRef, useState } from 'react';
import { productApi } from '../../services/api';
import { ENDPOINTS } from '../../services/config';
import { translateToHindi } from '../../services/translationService';

const DEBOUNCE_MS = 250;
const LIMIT = 40;

export default function useProductSearch(query, currentLanguage) {
    const [state, setState] = useState({ results: [], total: 0, loading: false, error: null, query: '' });
    const seq = useRef(0);

    useEffect(() => {
        const q = query.trim();
        const id = ++seq.current;
        if (!q) {
            setState({ results: [], total: 0, loading: false, error: null, query: '' });
            return undefined;
        }
        setState((s) => ({ ...s, loading: true, error: null }));
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

        const timer = setTimeout(async () => {
            try {
                const res = await productApi.get(ENDPOINTS.products.LIST, {
                    params: { search: q, limit: LIMIT },
                    signal: controller?.signal,
                });
                let list = res?.data?.products || [];
                if (currentLanguage === 'hi' && list.length) {
                    try {
                        list = await Promise.all(
                            list.map(async (p) => ({ ...p, translatedName: p.nameHi || (await translateToHindi(p.name)) }))
                        );
                    } catch (err) {
                        console.error('Translation error:', err);
                    }
                }
                if (id !== seq.current) return;
                setState({ results: list, total: res?.data?.total ?? list.length, loading: false, error: null, query: q });
            } catch (err) {
                if (id !== seq.current || err?.name === 'CanceledError' || err?.name === 'AbortError') return;
                console.error('Search error:', err);
                setState({ results: [], total: 0, loading: false, error: err, query: q });
            }
        }, DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
            controller?.abort();
        };
    }, [query, currentLanguage]);

    return state;
}
