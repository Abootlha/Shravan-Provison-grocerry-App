/**
 * GlassSurface — a SOLID surface + hairline by default (DESIGN.md: glass/blur max 2 uses).
 * The name is kept for old call sites; without `allowBlur` it is simply a surface-coloured box.
 *
 * Blur is reserved for the round buttons that float over PHOTOS or MAPS (PDP back/share/heart, map
 * controls). Pass `allowBlur` only there — never on headers, cards, sheets, the dock or search bars.
 *
 * Props
 *   tone        'light' (default — surface fill, ink content) | 'night' (ink fill, white content)
 *   allowBlur   boolean — frosted fill (expo-blur) instead of the solid. Photos / maps only. Default false.
 *   intensity   blur strength 0–100 when allowBlur (default 40)
 *   radius      number | radii key (default 'card')
 *   bordered    hairline border (default true)
 *   style       container style (padding, layout)
 *   children
 *
 * Platform (allowBlur only): iOS and web blur (web uses CSS backdrop-filter); Android falls back to
 * the solid fill.
 * Web: the blur + tint layers are absolutely positioned, and the browser paints positioned boxes
 * above non-positioned ones (e.g. a TextInput's <input>), so content under them came out blurred.
 * On web the children are therefore wrapped in a positioned layer (zIndex 1) that takes over the
 * container's flex layout (direction / alignment / gap) and fills it, so callers need no
 * `position: 'relative', zIndex` workarounds and layout is the same as on native.
 *
 * Example
 *   <GlassSurface radius="input" style={{ height: 48, paddingHorizontal: 16, justifyContent: 'center' }}>
 *     <Text color="secondary">Search for "milk"</Text>
 *   </GlassSurface>
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { radii } from '../../constants/theme';
import { makeThemed } from '../../theme';

// `fill` is the translucent tint laid over the blur (allowBlur only); `solid` is the default fill.
const useTones = makeThemed(({ colors: c, isDark }) => ({
    light: {
        fill: isDark ? 'rgba(26,26,26,0.72)' : 'rgba(255,255,255,0.78)',
        solid: c.glassSolid,
        border: c.glassBorder,
        blurTint: isDark ? 'dark' : 'light',
    },
    night: { fill: 'rgba(21,21,21,0.72)', solid: c.glassSolidNight, border: c.glassBorderNight, blurTint: 'dark' },
}));

const isWeb = Platform.OS === 'web';
const canBlur = Platform.OS === 'ios' || isWeb;

// Flex-layout keys the web content layer inherits from the container style.
const LAYOUT_KEYS = ['flexDirection', 'flexWrap', 'alignItems', 'alignContent', 'justifyContent', 'gap', 'rowGap', 'columnGap'];

export function GlassSurface({ tone = 'light', allowBlur = false, intensity = 40, radius = 'card', bordered = true, style, children, ...rest }) {
    const TONES = useTones();
    const t = TONES[tone] || TONES.light;
    const r = typeof radius === 'number' ? radius : radii[radius] ?? radii.card;
    const blur = allowBlur && canBlur;
    let content = children;
    if (isWeb && blur) {
        const flat = StyleSheet.flatten(style) || {};
        const layout = {};
        for (const k of LAYOUT_KEYS) if (flat[k] !== undefined) layout[k] = flat[k];
        content = (
            <View style={[styles.content, layout, { pointerEvents: 'box-none' }]}>
                {children}
            </View>
        );
    }
    return (
        <View
            style={[
                styles.base,
                { borderRadius: r, backgroundColor: blur ? 'transparent' : t.solid },
                bordered && { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.border },
                style,
            ]}
            {...rest}
        >
            {blur ? (
                <>
                    <BlurView tint={t.blurTint} intensity={intensity} style={[StyleSheet.absoluteFill, styles.layer, { borderRadius: r }, { pointerEvents: 'none' }]} />
                    <View style={[StyleSheet.absoluteFill, styles.layer, { borderRadius: r, backgroundColor: t.fill }, { pointerEvents: 'none' }]} />
                </>
            ) : null}
            {content}
        </View>
    );
}

const styles = StyleSheet.create({
    base: { overflow: 'hidden' },
    layer: { zIndex: 0 },
    // web only: positioned content layer above the blur; fills the container and takes its flex layout
    content: { position: 'relative', zIndex: 1, flexGrow: 1, flexShrink: 1, alignSelf: 'stretch', minWidth: 0, minHeight: 0 },
});

export default GlassSurface;
