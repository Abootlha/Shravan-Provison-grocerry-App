/**
 * useProductSearch — debounced (250 ms) product search against GET /products?search=
 * (same endpoint as ProductService.searchProducts). Each new query aborts the in-flight
 * request and stale responses are ignored. Hindi names are translated like Home/Category.
 *
 * Language help (searchSynonyms.js): the query is expanded with Hindi/Hinglish synonyms and small
 * typos are corrected against the catalogue vocabulary before it is sent ("doodh" → "milk doodh",
 * "paneeer" → "paneer"). `corrected` is the readable correction ("Showing results for 'milk'"),
 * null when the query went out as typed. `exact: true` sends it as typed ("Search instead for …").
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { productApi } from '../../services/api';
import { ENDPOINTS } from '../../services/config';
import { translateToHindi } from '../../services/translationService';
import { normalizeProductPage } from '../../services/normalize';
import { expandQuery } from './searchSynonyms';

const DEBOUNCE_MS = 250;
const LIMIT = 40;

export default function useProductSearch(query, currentLanguage, { vocabulary, exact = false } = {}) {
    const [state, setState] = useState({ results: [], total: 0, loading: false, error: null, query: '', corrected: null });
    const vocabRef = useRef(vocabulary);
    vocabRef.current = vocabulary;
    const vocabSize = vocabulary?.size || 0;
    const seq = useRef(0);
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    useEffect(() => {
        const q = query.trim();
        const id = ++seq.current;
        if (!q) {
            setState({ results: [], total: 0, loading: false, error: null, query: '', corrected: null });
            return undefined;
        }
        setState((s) => ({ ...s, loading: true, error: null }));
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

        const plan = exact ? { text: q, corrected: null } : expandQuery(q, vocabRef.current);
        const timer = setTimeout(async () => {
            try {
                const res = await productApi.get(ENDPOINTS.products.LIST, {
                    params: { search: plan.text || q, limit: LIMIT },
                    signal: controller?.signal,
                });
                const page = normalizeProductPage(res?.data, 'GET /products?search');
                let list = page.products;
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
                setState({ results: list, total: page.total ?? list.length, loading: false, error: null, query: q, corrected: list.length ? plan.corrected : null });
            } catch (err) {
                if (id !== seq.current || err?.name === 'CanceledError' || err?.name === 'AbortError') return;
                console.error('Search error:', err);
                setState({ results: [], total: 0, loading: false, error: err, query: q, corrected: null });
            }
        }, DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
            controller?.abort();
        };
    }, [query, currentLanguage, attempt, exact, vocabSize]);

    return { ...state, retry };
}
