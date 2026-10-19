/**
 * Restock watch — "Notify me" for sold-out products, kept on this device only.
 *
 * The backend has no back-in-stock subscription endpoint, so nothing here pretends to send a
 * notification. A watched product is remembered locally (AsyncStorage) and Home shows it in a
 * "Back in stock" rail once the catalogue reports stock again. Adding it to the cart (or tapping
 * "Notify me" again) forgets it.
 *
 *   const { isWatching, toggle, watchedIds } = useRestockWatch();
 *   watchProduct({ id, name }) / unwatchProduct(id)   imperative, from anywhere
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'restock:watch:v1';
const MAX = 50;

let entries = []; // [{ id, name, at }], newest first
let loaded = false;
let loading = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const load = () => {
    if (loaded) return Promise.resolve(entries);
    if (!loading) {
        loading = AsyncStorage.getItem(KEY)
            .then((raw) => {
                const list = JSON.parse(raw || '[]');
                if (Array.isArray(list)) entries = list.filter((e) => e && e.id).slice(0, MAX);
            })
            .catch(() => {})
            .finally(() => {
                loaded = true;
                emit();
            });
    }
    return loading;
};

const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {});

export function watchProduct({ id, name }) {
    if (!id) return;
    entries = [{ id: String(id), name: name || '', at: Date.now() }, ...entries.filter((e) => e.id !== String(id))].slice(0, MAX);
    persist();
    emit();
}

export function unwatchProduct(id) {
    if (!id || !entries.some((e) => e.id === String(id))) return;
    entries = entries.filter((e) => e.id !== String(id));
    persist();
    emit();
}

export function isWatched(id) {
    return !!id && entries.some((e) => e.id === String(id));
}

export function useRestockWatch() {
    const [, setTick] = useState(0);
    useEffect(() => {
        const fn = () => setTick((n) => n + 1);
        listeners.add(fn);
        load();
        return () => listeners.delete(fn);
    }, []);
    const isWatching = useCallback((id) => isWatched(id), []);
    const toggle = useCallback((product) => {
        if (isWatched(product?.id)) {
            unwatchProduct(product.id);
            return false;
        }
        watchProduct(product);
        return true;
    }, []);
    return { isWatching, toggle, watchedIds: entries.map((e) => e.id), loaded };
}

export default useRestockWatch;
