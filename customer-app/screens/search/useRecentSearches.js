/** useRecentSearches — last 8 search terms, newest first, persisted in AsyncStorage. { recent, add, remove, clear } */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'search:recent:v1';
const MAX = 8;

export default function useRecentSearches() {
    const [recent, setRecent] = useState([]);

    useEffect(() => {
        AsyncStorage.getItem(KEY)
            .then((raw) => {
                const list = JSON.parse(raw || '[]');
                if (Array.isArray(list)) setRecent(list.filter((t) => typeof t === 'string').slice(0, MAX));
            })
            .catch(() => {});
    }, []);

    const persist = (list) => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});

    const add = useCallback((term) => {
        const t = String(term || '').trim();
        if (t.length < 2) return;
        setRecent((prev) => {
            const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX);
            persist(next);
            return next;
        });
    }, []);

    const remove = useCallback((term) => {
        setRecent((prev) => {
            const next = prev.filter((x) => x !== term);
            persist(next);
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setRecent([]);
        AsyncStorage.removeItem(KEY).catch(() => {});
    }, []);

    return { recent, add, remove, clear };
}
