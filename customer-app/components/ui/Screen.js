/**
 * Screen — root wrapper for every screen: safe area + canvas background + status bar.
 *
 * Props
 *   edges        safe-area edges to pad (default ['top']; bottom is usually handled by the tab
 *                bar or a sticky footer). Pass [] when a coloured header draws under the notch.
 *   background   'canvas' (default; painted by the navigator's contentStyle, not by Screen) |
 *                'surface' | any colour string
 *   wash         @deprecated — ignored. The lavender top wash is removed; canvas is flat (DESIGN.md).
 *   statusBar    'dark' | 'light' — icon colour. Default: follows the theme ('dark' icons in light mode,
 *                'light' in dark mode). Pass 'light' on violet / night headers, or the active header
 *                theme's `statusBar` (useTheme().headerThemes.default.statusBar).
 *   topInsetColor colour painted behind the status bar (e.g. HEADER_THEMES.default.bg so the
 *                violet header bleeds under the notch while content stays safe)
 *   style        style for the inner container
 *
 * Example
 *   <Screen topInsetColor={HEADER_THEMES.default.bg}>
 *     <Header /> <FlashList ... />
 *   </Screen>
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme';

// eslint-disable-next-line no-unused-vars -- `wash` accepted for old call sites and ignored
export function Screen({ edges = ['top'], background = 'canvas', wash, statusBar, topInsetColor, style, children }) {
    const insets = useSafeAreaInsets();
    const { colors, isDark } = useTheme();
    // 'canvas' is already painted by the navigator (native-stack contentStyle), so the default
    // Screen adds no full-screen fill of its own: each stacked opaque layer is a full-screen
    // overdraw pass on every frame (GPU fill rate on low-end phones). Other backgrounds paint here.
    const bg = background === 'canvas' ? undefined : background === 'surface' ? colors.surface : background;
    const pad = {
        paddingTop: edges.includes('top') ? insets.top : 0,
        paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        paddingLeft: edges.includes('left') ? insets.left : 0,
        paddingRight: edges.includes('right') ? insets.right : 0,
    };
    return (
        <View style={[styles.root, bg ? { backgroundColor: bg } : null]}>
            <StatusBar style={statusBar || (isDark ? 'light' : 'dark')} />
            {topInsetColor ? <View style={[styles.topInset, { height: insets.top, backgroundColor: topInsetColor }]} /> : null}
            <View style={[styles.root, pad, style]}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    topInset: { position: 'absolute', top: 0, left: 0, right: 0 },
});

export default Screen;
