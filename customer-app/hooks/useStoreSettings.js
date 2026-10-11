/**
 * Store settings (GET /settings/store) shared by every screen, plus the open / closed status.
 *
 *   useStoreSettings()  -> { settings, loaded, failed, reload }
 *   useStoreStatus()    -> { isOpen, nextOpenAt, etaMinutes, opensLabel(isHi), closedLine(isHi) }
 *   markStoreClosed(nextOpenAt)   called when POST /orders answers 409 STORE_CLOSED
 *
 * Rules (no guessing):
 *   - `isOpen` comes from the server only. Missing → treated as open. Nothing is computed from
 *     storeTimings and the device clock.
 *   - `etaMinutes` is the server's estimatedDeliveryMinutes, or null (callers show nothing).
 *
 * One request is shared through SettingsService's in-flight cache; every mounted hook re-renders
 * when the value changes (including a 409 that flips the store to closed).
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SettingsService } from '../services';

// Dev-only preview of the closed-store states on web: open the app with ?store=closed.
// (The flag and the made-up reopening time never exist in a production bundle.)
const DEV_FORCE_CLOSED =
    __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && /[?&]store=closed(&|$)/.test(window.location.search);
const devNextOpen = () => {
    const d = new Date();
    if (d.getHours() >= 8) d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.toISOString();
};

let current = null; // last settings object (unwrapped)
let override = null; // { isOpen: false, nextOpenAt } from a 409, until the next successful fetch
let failed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const unwrap = (body) => {
    if (!body || typeof body !== 'object') return null;
    const inner = body.settings && typeof body.settings === 'object' ? body.settings : body;
    // isOpen / nextOpenAt may sit next to `settings` or inside it
    if (DEV_FORCE_CLOSED) return { ...inner, isOpen: false, nextOpenAt: devNextOpen() };
    return {
        ...inner,
        isOpen: inner.isOpen ?? body.isOpen,
        nextOpenAt: inner.nextOpenAt ?? body.nextOpenAt,
    };
};

const STALE_MS = 60 * 1000;
let lastLoadAt = 0;
let loading = null;
let lastJson = '';

export function loadStoreSettings({ fresh = false } = {}) {
    if (loading) return loading;
    lastLoadAt = Date.now();
    loading = SettingsService.getStoreSettings({ fresh })
        .then((body) => {
            const next = unwrap(body);
            const json = JSON.stringify(next);
            const changed = json !== lastJson || override || failed;
            current = next;
            lastJson = json;
            override = null;
            failed = false;
            if (changed) emit();
            return current;
        })
        .catch((err) => {
            if (__DEV__) console.warn('[store] settings request failed', err?.message);
            if (!current && !failed) {
                failed = true;
                emit();
            }
            return current;
        })
        .finally(() => {
            loading = null;
        });
    return loading;
}

/** POST /orders said the store is closed: show it everywhere right away. */
export function markStoreClosed(nextOpenAt) {
    override = { isOpen: false, nextOpenAt: nextOpenAt || null };
    emit();
}

export function useStoreSettings() {
    const [, setTick] = useState(0);
    useEffect(() => {
        const fn = () => setTick((n) => n + 1);
        listeners.add(fn);
        // every card mounts this hook: only the first (or a stale) mount actually asks the server
        if ((!current && !failed) || Date.now() - lastLoadAt > STALE_MS) loadStoreSettings();
        return () => listeners.delete(fn);
    }, []);
    const reload = useCallback(() => loadStoreSettings({ fresh: true }), []);
    const settings = current ? { ...current, ...(override || {}) } : override;
    return { settings, loaded: !!current, failed, reload };
}

const pad2 = (n) => String(n).padStart(2, '0');
const clock = (h, m) => {
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return m ? `${hr}:${pad2(m)} ${suffix}` : `${hr} ${suffix}`;
};

/**
 * "8 AM" / "tomorrow, 8 AM" from the server's nextOpenAt (ISO date-time, epoch ms, or "HH:mm").
 * Null when it can't be read.
 */
export function formatOpensAt(nextOpenAt, isHi, now = new Date()) {
    if (nextOpenAt == null || nextOpenAt === '') return null;
    const hhmm = typeof nextOpenAt === 'string' && /^\d{1,2}:\d{2}$/.test(nextOpenAt.trim());
    if (hhmm) {
        const [h, m] = nextOpenAt.trim().split(':').map(Number);
        return clock(h, m);
    }
    const d = new Date(nextOpenAt);
    if (Number.isNaN(d.getTime())) return null;
    const time = clock(d.getHours(), d.getMinutes());
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOf(d) - startOf(now)) / 86400000);
    if (days <= 0) return time;
    if (days === 1) return isHi ? `कल ${time}` : `tomorrow, ${time}`;
    const day = d.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { weekday: 'short' });
    return `${day}, ${time}`;
}

export function useStoreStatus() {
    const { settings, loaded, failed, reload } = useStoreSettings();
    const isOpen = settings?.isOpen !== false;
    const nextOpenAt = isOpen ? null : settings?.nextOpenAt || null;
    const eta = Number(settings?.estimatedDeliveryMinutes);
    const etaMinutes = Number.isFinite(eta) && eta > 0 ? eta : null;
    return {
        settings,
        loaded,
        failed,
        reload,
        isOpen,
        nextOpenAt,
        etaMinutes,
        /** "Opens 8 AM" (or "Closed" when the server gave no reopening time). */
        opensLabel: (isHi) => {
            const at = formatOpensAt(nextOpenAt, isHi);
            if (!at) return isHi ? 'अभी बंद है' : 'Closed';
            return isHi ? `${at} खुलेगा` : `Opens ${at}`;
        },
        /** "Closed · opens at 8 AM" for headers and banners. */
        closedLine: (isHi) => {
            const at = formatOpensAt(nextOpenAt, isHi);
            if (!at) return isHi ? 'स्टोर अभी बंद है' : 'Store closed right now';
            return isHi ? `बंद · ${at} खुलेगा` : `Closed · opens at ${at}`;
        },
    };
}

export default useStoreStatus;
