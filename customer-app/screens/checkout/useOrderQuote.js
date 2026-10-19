/**
 * The authoritative checkout bill: POST /orders/quote for the cart lines, debounced on every
 * cart change and run once when checkout opens. The slide-to-pay amount is the quote's
 * totalAmount and nothing else.
 *
 * Refused lines: the server answers 400 when a product is archived / draft / unpriced
 * ("… is no longer available") or short on stock ("Insufficient stock for …"), and names only
 * the first bad line. We then quote each line on its own to find every refused one, report
 * them (`refused`), and quote the rest so the bill still reflects what can be bought.
 * Nothing is dropped from the cart here; the screen lists the refused lines and lets the
 * customer remove them, and payment stays blocked until they do.
 *
 *   { status: 'idle' | 'loading' | 'ready' | 'error', quote, refused: [{ id, name, reason }], ready, retry }
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OrderService } from '../../services';
import { markStoreClosed } from '../../hooks/useStoreSettings';

const DEBOUNCE_MS = 350;

export const lineIdOf = (item) => String(item?.productId || item?._id || item?.id || '');

// A pack-size line also names its variant; the server prices and reserves that pack.
const toLine = (item) => ({
    productId: lineIdOf(item),
    quantity: Number(item.quantity) || 1,
    ...(item.variantSku ? { variantSku: item.variantSku } : {}),
});

const reasonOf = (error) => {
    const msg = String(error?.response?.data?.message || '');
    return /stock/i.test(msg) ? 'stock' : 'unavailable';
};

const isRefusal = (error) => error?.response?.status === 400;

export function useOrderQuote(cartItems, { enabled = true } = {}) {
    const items = cartItems || [];
    // Only product (+ pack size) + quantity change the bill.
    const key = useMemo(() => items.map((i) => `${lineIdOf(i)}:${i.variantSku || ''}x${Number(i.quantity) || 1}`).join('|'), [items]);
    const [state, setState] = useState({ status: 'idle', key: null, quote: null, refused: [] });
    const [attempt, setAttempt] = useState(0);
    const seq = useRef(0);
    const itemsRef = useRef(items);
    itemsRef.current = items;

    useEffect(() => {
        if (!enabled || !key) {
            seq.current += 1;
            setState({ status: 'idle', key: null, quote: null, refused: [] });
            return undefined;
        }
        const run = ++seq.current;
        setState((s) => ({ ...s, status: 'loading' }));
        const timer = setTimeout(async () => {
            const lines = itemsRef.current;
            const stale = () => run !== seq.current;
            try {
                let refused = [];
                let quote = null;
                try {
                    quote = await OrderService.quoteOrder(lines.map(toLine));
                } catch (error) {
                    if (!isRefusal(error)) throw error;
                    // Find every refused line (the server only names the first).
                    const probes = await Promise.all(
                        lines.map((item) =>
                            OrderService.quoteOrder([toLine(item)])
                                .then(() => null)
                                .catch((e) => {
                                    if (!isRefusal(e)) throw e;
                                    return { id: item.id, productId: lineIdOf(item), name: item.name, reason: reasonOf(e) };
                                }),
                        ),
                    );
                    refused = probes.filter(Boolean);
                    // Every line passes alone but not together: nothing we can point at.
                    if (!refused.length) throw error;
                    const bad = new Set(refused.map((r) => r.id));
                    const rest = lines.filter((i) => !bad.has(i.id));
                    if (rest.length) quote = await OrderService.quoteOrder(rest.map(toLine));
                }
                if (stale()) return;
                if (quote && quote.isOpen === false) markStoreClosed(quote.nextOpenAt);
                setState({ status: 'ready', key, quote, refused });
            } catch (error) {
                if (stale()) return;
                if (__DEV__) console.warn('[checkout] quote failed', error?.response?.status, error?.message);
                setState((s) => ({ ...s, status: 'error', key }));
            }
        }, DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [enabled, key, attempt]);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    const current = state.key === key;
    const status = !enabled || !key ? 'idle' : current ? state.status : 'loading';
    const refused = current ? state.refused : state.refused.filter((r) => items.some((i) => i.id === r.id));
    return {
        status,
        quote: current && status === 'ready' ? state.quote : null,
        refused,
        // Payable: a fresh quote for exactly this cart, with nothing refused.
        ready: status === 'ready' && !!state.quote && state.refused.length === 0,
        retry,
    };
}

export default useOrderQuote;
