export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'admin-theme';

/**
 * Inline script for <head>: applies the stored theme before first paint so there is no flash.
 * Kept as a string so the layout can inline it with `is:inline`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export function readThemePreference(): ThemePreference {
    try {
        const value = localStorage.getItem(THEME_STORAGE_KEY);
        return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
        return 'system';
    }
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
    if (preference !== 'system') return preference;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference: ThemePreference) {
    const resolved = resolveTheme(preference);
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
    window.dispatchEvent(new CustomEvent('admin-theme-change', { detail: { preference, resolved } }));
}

export function setThemePreference(preference: ThemePreference) {
    try {
        if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
        else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
        // Storage blocked: the choice still applies for this page view.
    }
    applyTheme(preference);
}
