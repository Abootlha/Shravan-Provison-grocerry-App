/**
 * Minimal request de-duplication for GETs (until the TanStack Query migration):
 *
 *   cachedRequest(key, fetcher, { ttl, fresh })
 *
 * - Concurrent callers with the same key share ONE in-flight promise.
 * - A resolved value is reused for `ttl` ms (default 0: in-flight sharing only).
 * - `fresh: true` skips the stored value (pull-to-refresh, retry) but still joins an in-flight call.
 * - Failures are never cached.
 *
 *   invalidate(prefix)  drop stored values whose key starts with `prefix` (after a write)
 */
const inflight = new Map();
const store = new Map(); // key -> { value, at }

export function cachedRequest(key, fetcher, { ttl = 0, fresh = false } = {}) {
    if (!fresh && ttl > 0) {
        const hit = store.get(key);
        if (hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.value);
    }
    const pending = inflight.get(key);
    if (pending) return pending;
    const p = Promise.resolve()
        .then(fetcher)
        .then((value) => {
            if (ttl > 0) store.set(key, { value, at: Date.now() });
            return value;
        })
        .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
}

/** Last stored value for `key` (any age), or undefined. Lets screens paint instantly on revisit. */
export function peekCached(key) {
    return store.get(key)?.value;
}

export function invalidate(prefix = '') {
    for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
}

/** Stable key fragment for a params object. */
export const paramsKey = (params = {}) =>
    JSON.stringify(
        Object.keys(params)
            .sort()
            .map((k) => [k, params[k]]),
    );
