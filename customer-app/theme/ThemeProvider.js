/**
 * Theme runtime — light / dark / system, persisted.
 *
 *   import { useTheme, makeStyles, makeThemed } from '../theme';
 *
 *   const { colors, gradients, shadows, isDark, scheme, mode, setMode } = useTheme();
 *   const styles = useStyles();            // from `const useStyles = makeStyles((t) => ({ … }))`
 *
 * ThemeProvider (mounted once in App.js)
 *   mode      'system' (default) | 'light' | 'dark' — persisted in AsyncStorage under STORAGE_KEY
 *   scheme    the resolved 'light' | 'dark' (system mode follows the OS via useColorScheme)
 *   Renders nothing until the stored mode is read (a few ms), so the first frame is already in
 *   the right scheme. On native it also calls Appearance.setColorScheme so OS-drawn UI (alerts,
 *   keyboard, date pickers) follows an explicit choice; on web it sets `color-scheme` and the
 *   page background so overscroll and form controls match.
 *
 * useTheme() → the active theme object (stable identity per scheme + mode):
 *   { scheme, isDark, mode, setMode, colors, gradients, shadows, hardEdge, highlightTop,
 *     highlightTopOnBrand, headerThemes, tileTint(i), type, fontFamily, displayFamily, space, s, radii, z, HIT }
 *   Outside a provider it returns the light theme (setMode is a no-op) so nothing crashes.
 *
 * makeStyles((t) => ({ … }))  → a hook `useStyles()` returning StyleSheet.create(factory(t)),
 *   built lazily ONCE per scheme and cached for the life of the app (zero cost per render).
 * makeThemed((t) => anything) → a hook returning factory(t) cached per scheme — for non-style
 *   lookup tables (variant maps, gradient arrays, icon colours) that used to be module constants.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform, StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { colors as lightColors, darkColors, themes } from '../constants/theme';

export const STORAGE_KEY = '@shravankirana/theme-mode';
export const THEME_MODES = ['system', 'light', 'dark'];

const withMode = (scheme, mode, setMode) => ({ ...themes[scheme], mode, setMode });
const noop = () => {
    if (__DEV__) console.warn('[theme] setMode called outside <ThemeProvider>.');
};
const FALLBACK = withMode('light', 'light', noop);

const ThemeContext = createContext(FALLBACK);

// Dev guard: darkColors must mirror every key of colors (nested objects included).
if (__DEV__) {
    const missing = [];
    const walk = (a, b, path) => {
        for (const k of Object.keys(a)) {
            if (!(k in b)) missing.push(path + k);
            else if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) walk(a[k], b[k] || {}, `${path}${k}.`);
        }
    };
    walk(lightColors, darkColors, '');
    walk(darkColors, lightColors, '');
    if (missing.length) console.warn(`[theme] colors / darkColors key mismatch: ${missing.join(', ')}`);
}

export function ThemeProvider({ children, initialMode }) {
    const system = useColorScheme();
    const [mode, setModeState] = useState(initialMode || 'system');
    const [hydrated, setHydrated] = useState(!!initialMode);
    // The OS scheme, remembered while an explicit mode overrides Appearance (see effect below).
    const [osScheme, setOsScheme] = useState(system === 'dark' ? 'dark' : 'light');

    useEffect(() => {
        if (initialMode) return;
        let alive = true;
        AsyncStorage.getItem(STORAGE_KEY)
            .then((v) => alive && THEME_MODES.includes(v) && setModeState(v))
            .catch(() => {})
            .finally(() => alive && setHydrated(true));
        return () => {
            alive = false;
        };
    }, [initialMode]);

    // While mode is 'system', useColorScheme is the OS value; track it.
    useEffect(() => {
        if (mode === 'system' && system) setOsScheme(system === 'dark' ? 'dark' : 'light');
    }, [mode, system]);

    // Native: make OS-drawn UI follow an explicit choice ('unspecified' hands control back to the OS).
    useEffect(() => {
        if (Platform.OS === 'web' || typeof Appearance.setColorScheme !== 'function') return;
        try {
            Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
        } catch {
            // older runtimes: ignore — the app UI still follows `scheme`
        }
    }, [mode]);

    const scheme = mode === 'system' ? osScheme : mode;

    // Web: page background + native form controls / scrollbars.
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;
        const root = document.documentElement;
        root.style.colorScheme = scheme;
        root.style.backgroundColor = themes[scheme].colors.canvas;
        if (document.body) document.body.style.backgroundColor = themes[scheme].colors.canvas;
    }, [scheme]);

    const setMode = useCallback((next) => {
        if (!THEME_MODES.includes(next)) return;
        setModeState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    }, []);

    const value = useMemo(() => withMode(scheme, mode, setMode), [scheme, mode, setMode]);

    if (!hydrated) return null;
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme. See the file header for the shape. */
export function useTheme() {
    return useContext(ThemeContext);
}

/**
 * makeStyles((t) => ({ … })) → useStyles(). The factory runs once per scheme; the result is a
 * regular StyleSheet, so `styles.foo` works exactly like before.
 */
export function makeStyles(factory) {
    const cache = {};
    return function useStyles() {
        const { scheme } = useContext(ThemeContext);
        return cache[scheme] || (cache[scheme] = StyleSheet.create(factory(themes[scheme])));
    };
}

/** makeThemed((t) => value) → useThemed(). Same caching as makeStyles, without StyleSheet.create. */
export function makeThemed(factory) {
    const cache = {};
    return function useThemed() {
        const { scheme } = useContext(ThemeContext);
        return cache[scheme] || (cache[scheme] = factory(themes[scheme]));
    };
}

const navThemes = {};
/** React Navigation theme for the active scheme (pass to <NavigationContainer theme>). */
export function useNavigationTheme() {
    const { scheme } = useContext(ThemeContext);
    if (!navThemes[scheme]) {
        const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
        const c = themes[scheme].colors;
        navThemes[scheme] = {
            ...base,
            dark: scheme === 'dark',
            colors: {
                ...base.colors,
                primary: c.brandText,
                background: c.canvas,
                card: c.surface,
                text: c.ink,
                border: c.hairline,
                notification: c.error,
            },
        };
    }
    return navThemes[scheme];
}

export default ThemeProvider;
