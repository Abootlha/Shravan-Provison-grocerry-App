import { useCallback, useEffect, useState } from 'react';
import { readThemePreference, resolveTheme, setThemePreference, type ThemePreference } from '@/lib/theme';

/** Current theme preference and the resolved light/dark value; stays in sync across islands. */
export function useTheme() {
    const [preference, setPreference] = useState<ThemePreference>('system');
    const [resolved, setResolved] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const sync = () => {
            setPreference(readThemePreference());
            setResolved(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        };
        sync();
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onSystemChange = () => {
            if (readThemePreference() === 'system') setThemePreference('system');
        };
        window.addEventListener('admin-theme-change', sync);
        media.addEventListener('change', onSystemChange);
        return () => {
            window.removeEventListener('admin-theme-change', sync);
            media.removeEventListener('change', onSystemChange);
        };
    }, []);

    const update = useCallback((next: ThemePreference) => {
        setThemePreference(next);
        setPreference(next);
        setResolved(resolveTheme(next));
    }, []);

    return { preference, resolved, setPreference: update };
}
