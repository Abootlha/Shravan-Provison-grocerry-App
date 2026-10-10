/**
 * Smooth light ↔ dark switch for Profile → Appearance (no flash, no hard cut).
 *
 *   const xfade = useThemeCrossfade();
 *   <View {...xfade.armProps}><ThemeModeControl … /></View>     // arm before the tap lands (web)
 *   {xfade.veil}                                                 // last child of the screen (native)
 *
 * Web: arming (pointer / key down on the control) adds a short-lived class to <html> that gives every
 * element a 280 ms ease-out transition on its colour properties, so when the scheme flips every
 * background, text, border, fill and shadow cross-fades to its new value. The class is removed once
 * the switch has settled (and after 1.2 s regardless), so normal UI colour changes stay instant.
 * Native (no global colour transitions): the frame the scheme flips, a veil in the OLD canvas colour
 * covers the screen and fades out over 280 ms, so the new palette dissolves in instead of cutting.
 * Reduced motion: web keeps the colour fade (it is not movement); native skips the veil.
 */
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { easings } from '../../theme/motion';

const WEB = Platform.OS === 'web' && typeof document !== 'undefined';
const MS = 280;
const CLASS = 'sk-theme-xfade';
const STYLE_ID = 'sk-theme-xfade-style';

function ensureWebStyle() {
    if (!WEB || document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    const ease = 'cubic-bezier(0.23,1,0.32,1)';
    const props = ['background-color', 'color', 'border-color', 'fill', 'stroke', 'box-shadow', 'outline-color']
        .map((p) => `${p} ${MS}ms ${ease}`)
        .join(', ');
    el.textContent = `html.${CLASS}, html.${CLASS} *, html.${CLASS} *::before, html.${CLASS} *::after { transition: ${props} !important; }`;
    document.head.appendChild(el);
}

function Veil({ color, onDone }) {
    const o = useSharedValue(1);
    useLayoutEffect(() => {
        o.value = withTiming(0, { duration: MS, easing: easings.out });
        const t = setTimeout(onDone, MS + 40);
        return () => clearTimeout(t);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const style = useAnimatedStyle(() => ({ opacity: o.value }));
    return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }, style, { pointerEvents: 'none' }]} />;
}

export function useThemeCrossfade() {
    const { scheme, colors } = useTheme();
    const reduce = useReducedMotion();
    const prev = useRef({ scheme, canvas: colors.canvas });
    const timer = useRef(null);
    const [veil, setVeil] = useState(null);

    const disarm = useCallback(() => {
        if (WEB) document.documentElement.classList.remove(CLASS);
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    }, []);

    const arm = useCallback(() => {
        if (!WEB) return;
        ensureWebStyle();
        document.documentElement.classList.add(CLASS);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(disarm, 1200); // tapped the current mode / cancelled: tidy up
    }, [disarm]);

    // Runs before paint on the frame the scheme flips.
    useLayoutEffect(() => {
        const was = prev.current;
        prev.current = { scheme, canvas: colors.canvas };
        if (was.scheme === scheme) return;
        if (WEB) {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(disarm, MS + 120);
            return;
        }
        if (!reduce) setVeil({ key: Date.now(), color: was.canvas });
    }, [scheme]); // eslint-disable-line react-hooks/exhaustive-deps

    // Web: listen in the capture phase on the wrapper's DOM node (before the control's own handlers).
    const node = useRef(null);
    const armRef = useCallback(
        (el) => {
            if (!WEB) return;
            if (node.current) {
                node.current.removeEventListener('pointerdown', arm, true);
                node.current.removeEventListener('keydown', arm, true);
            }
            node.current = el && el.addEventListener ? el : null;
            if (node.current) {
                node.current.addEventListener('pointerdown', arm, true);
                node.current.addEventListener('keydown', arm, true);
            }
        },
        [arm],
    );
    const armProps = WEB ? { ref: armRef } : {};

    return {
        armProps,
        veil: veil ? <Veil key={veil.key} color={veil.color} onDone={() => setVeil(null)} /> : null,
    };
}

export default useThemeCrossfade;
