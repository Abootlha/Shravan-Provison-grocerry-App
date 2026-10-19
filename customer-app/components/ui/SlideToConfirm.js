/**
 * SlideToConfirm — Swiggy-style slide-to-pay. Drag the white knob to the end to confirm.
 * Released early → springs back. A quick flick past 40% also confirms (velocity aware).
 * After confirming, the knob stays at the end and shows a spinner while `loading`.
 *
 * Props
 *   label           string — e.g. "Slide to pay ₹248" (static text + a static chevron hint; no shimmer loop)
 *   hintLabel       string — shown briefly when the track is tapped instead of slid (default "Slide to confirm");
 *                   the tap also nudges the knob once so the drag is discoverable
 *   confirmedLabel  string — shown after confirm (default "Processing…")
 *   onConfirm       () => void | Promise — a rejected promise resets the slider
 *   loading         boolean — show spinner in the knob (controlled; defaults to true right after confirm
 *                   until you reset or unmount)
 *   disabled        boolean
 *   tone            'accent' (solid brand violet track, default) | 'dark' (solid ink track)
 * Shape: track radius 12, knob radius 8 (no pills). Flat: no gradient, no sheen, no glow.
 *   style
 *   ref             { reset() } — slide back to start (e.g. after a payment failure)
 *
 * Accessibility: exposed as a button. Screen-reader users double-tap (the 'activate' action)
 * to confirm — no dragging required. On web it is in the tab order (role="button"); Enter or
 * Space arms it (the label says "Press Enter again to confirm") and a second
 * Enter / Space within 4s confirms, so one stray key never pays. Escape disarms.
 * Haptics: selection tick when crossing the threshold, success on confirm.
 *
 * Fast flicks count: the release position is projected forward by the fling velocity, so a quick
 * drag that lets go at half way still confirms (a slow drag must pass 82%).
 *
 * Example
 *   const slider = useRef(null);
 *   <SlideToConfirm ref={slider} label={`Slide to pay ₹${total}`} loading={paying}
 *     onConfirm={async () => { try { await pay(); } catch (e) { slider.current.reset(); } }} />
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type } from '../../constants/theme';
import { makeStyles, makeThemed } from '../../theme';
import { springs, easings } from '../../theme/motion';
import haptics from './haptics';

const H = 60;
const PAD = 4;
const KNOB = H - PAD * 2;
const THRESH = 0.82;
// Where a fling would carry the knob: release x + velocity × this many seconds.
const FLING_PROJECTION_S = 0.2;
const ARM_MS = 4000;
const WEB = Platform.OS === 'web';
// web: stop text selection / native panning from stealing the drag (vertical page scroll still allowed)
const WEB_DRAG = Platform.OS === 'web' ? { touchAction: 'pan-y', userSelect: 'none', cursor: 'grab' } : null;

const TRACK_RADIUS = 12;
const KNOB_RADIUS = 8;
// trail = the filled part behind the knob: the pressed brand shade (one step darker, still flat)
const useTones = makeThemed(({ colors: c }) => ({
    accent: { track: c.brand, trail: c.violet[700], fg: c.onBrand, icon: c.violet[600] },
    dark: { track: c.surfaceNight, trail: c.night[950], fg: c.onNight, icon: c.neutral[900] },
}));

export const SlideToConfirm = forwardRef(function SlideToConfirm(
    {
        label, hintLabel = 'Slide to confirm', armedLabel = 'Press Enter again to confirm', confirmedLabel = 'Processing…',
        onConfirm, loading, disabled = false, tone = 'accent', style,
    },
    ref,
) {
    const TONES = useTones();
    const styles = useStyles();
    const t = TONES[tone] || TONES.accent;
    const reduce = useReducedMotion();
    const [w, setW] = useState(0);
    const [done, setDone] = useState(false);
    const max = Math.max(0, w - KNOB - PAD * 2);
    const x = useSharedValue(0);
    const start = useSharedValue(0);
    const crossed = useSharedValue(false);
    // Own fling velocity from the last two moves: the web gesture handler reports velocityX 0.
    const track = useSharedValue({ x0: 0, t0: 0, x1: 0, t1: 0 });
    const [hint, setHint] = useState(false);
    const hintTimer = useRef(null);
    const [armed, setArmed] = useState(false);
    const [focused, setFocused] = useState(false); // keyboard: first Enter/Space arms, second confirms
    const armTimer = useRef(null);
    useEffect(() => () => {
        clearTimeout(hintTimer.current);
        clearTimeout(armTimer.current);
    }, []);

    // one-time nudge so people discover the drag (fires once when the track is measured; never loops)
    useEffect(() => {
        if (reduce || !max || disabled) return;
        x.value = withDelay(
            700,
            withSequence(withTiming(22, { duration: 180, easing: easings.out }), withSpring(0, springs.bouncy)),
        );
    }, [max > 0]);

    const reset = () => {
        setDone(false);
        setArmed(false);
        crossed.value = false;
        x.value = withSpring(0, springs.drag);
    };
    useImperativeHandle(ref, () => ({ reset }), []);

    const confirm = () => {
        if (done) return;
        clearTimeout(armTimer.current);
        setArmed(false);
        haptics.success();
        setDone(true);
        x.value = withSpring(max, springs.snappy);
        const r = onConfirm && onConfirm();
        if (r && typeof r.then === 'function') r.catch(() => reset());
    };

    // A plain JS function for worklets to schedule. `haptics` is a function object with methods attached;
    // captured into a worklet it becomes a remote function without those properties, so
    // `haptics.selection` was undefined on the UI runtime and scheduleOnRN(undefined) aborted the app.
    const selectionTick = () => haptics.selection();
    const pan = Gesture.Pan()
        .enabled(!disabled && !done && max > 0)
        .activeOffsetX([-8, 8])
        .failOffsetY([-16, 16])
        .onBegin(() => {
            cancelAnimation(x);
            start.value = x.value;
            const now = Date.now();
            track.value = { x0: x.value, t0: now, x1: x.value, t1: now };
        })
        .onUpdate((e) => {
            const nx = Math.min(Math.max(start.value + e.translationX, 0), max);
            const p = track.value;
            track.value = { x0: p.x1, t0: p.t1, x1: nx, t1: Date.now() };
            x.value = nx;
            const over = nx > max * THRESH;
            if (over !== crossed.value) {
                crossed.value = over;
                scheduleOnRN(selectionTick);
            }
        })
        .onEnd((e) => {
            const p = track.value;
            const dt = p.t1 - p.t0;
            const recent = Date.now() - p.t1 < 120; // still moving when released, not a pause-then-let-go
            const ownV = dt > 0 && recent ? ((p.x1 - p.x0) / dt) * 1000 : 0;
            const v = Math.max(e.velocityX || 0, ownV);
            const projected = x.value + Math.max(0, v) * FLING_PROJECTION_S;
            if (x.value > max * THRESH || (v > 300 && x.value > max * 0.25 && projected > max * THRESH)) {
                x.value = withSpring(max, springs.snappy);
                scheduleOnRN(confirm);
            } else {
                crossed.value = false;
                x.value = withSpring(0, springs.drag);
            }
        });

    // A tap instead of a slide: nudge the knob once and say what to do (label swaps back after a beat).
    const nudge = () => {
        if (done || disabled || !max) return;
        haptics.light();
        if (!reduce) {
            x.value = withSequence(withTiming(28, { duration: 160, easing: easings.out }), withSpring(0, springs.bouncy));
        }
        setHint(true);
        clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHint(false), 1800);
    };
    // Keyboard (web): Enter / Space arms, the second press confirms; Escape or 4s disarms.
    const disarm = () => {
        clearTimeout(armTimer.current);
        setArmed(false);
        if (!done) x.value = withSpring(0, springs.drag);
    };
    const onKeyDown = (e) => {
        if (disabled || done) return;
        const key = e.nativeEvent?.key ?? e.key;
        if (key === 'Escape') {
            if (armed) disarm();
            return;
        }
        if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
        e.preventDefault?.();
        if (armed) {
            confirm();
            return;
        }
        haptics.light();
        setArmed(true); // the label turns into the confirm step; the knob stays put so it stays readable
        clearTimeout(armTimer.current);
        armTimer.current = setTimeout(disarm, ARM_MS);
    };
    // RN-web turns accessibilityRole="button" into a <button> (no onLayout, swallows the drag), so
    // the element stays a div and gets its button role here.
    const trackRef = useRef(null);
    useEffect(() => {
        if (WEB && trackRef.current?.setAttribute) trackRef.current.setAttribute('role', 'button');
    }, []);

    const tap = Gesture.Tap()
        .enabled(!disabled && !done && max > 0)
        .onEnd((_e, success) => {
            if (success) scheduleOnRN(nudge);
        });

    const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
    const trailStyle = useAnimatedStyle(() => ({
        opacity: interpolate(x.value, [0, 16], [0, 1], 'clamp'),
        transform: [{ translateX: x.value - w + KNOB + PAD * 2 }],
    }));
    const labelStyle = useAnimatedStyle(() => ({
        opacity: max ? interpolate(x.value, [0, max * 0.6], [1, 0], 'clamp') : 1,
        transform: [{ translateX: reduce ? 0 : interpolate(x.value, [0, max || 1], [0, 24], 'clamp') }],
    }));

    const busy = done && loading !== false;

    return (
        // One detector on the whole track: a fast drag that outruns the 52pt knob stays on the track,
        // so the pan keeps receiving moves (on the knob alone a quick web drag lost the pointer).
        <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
            <View
                ref={trackRef}
                accessible
                accessibilityRole={WEB ? undefined : 'button'}
                accessibilityLabel={done ? confirmedLabel : armed ? `${label}. ${armedLabel}` : label}
                accessibilityHint="Swipe right, or double tap, to confirm"
                accessibilityState={{ disabled, busy }}
                focusable={WEB && !disabled && !done}
                onKeyDown={WEB ? onKeyDown : undefined}
                onFocus={WEB ? () => setFocused(true) : undefined}
                onBlur={WEB ? () => { setFocused(false); if (armed) disarm(); } : undefined}
                accessibilityActions={[{ name: 'activate' }]}
                onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && !disabled && confirm()}
                onLayout={(e) => setW(e.nativeEvent.layout.width)}
                style={[styles.track, WEB_DRAG, { backgroundColor: t.track, opacity: disabled ? 0.45 : 1 }, focused && styles.focusRing, style]}
            >
                <View style={[StyleSheet.absoluteFill, styles.clip, { pointerEvents: 'none' }]}>
                    {w > 0 ? <Animated.View style={[styles.trail, { width: w, backgroundColor: t.trail }, trailStyle, { pointerEvents: 'none' }]} /> : null}
                </View>

                <View style={[styles.labelWrap, { pointerEvents: 'none' }]}>
                    {done ? (
                        <Animated.Text style={[type.button, { color: t.fg }]}>{confirmedLabel}</Animated.Text>
                    ) : (
                        <Animated.View style={[styles.labelRow, labelStyle]}>
                            <Animated.Text numberOfLines={1} style={[type.button, { color: t.fg }]}>
                                {armed ? armedLabel : hint ? hintLabel : label}
                            </Animated.Text>
                        </Animated.View>
                    )}
                </View>

                <Animated.View style={[styles.knob, knobStyle, { pointerEvents: 'none' }]}>
                    {busy ? (
                        <ActivityIndicator color={t.icon} />
                    ) : done ? (
                        <MaterialCommunityIcons name="check-bold" size={24} color={t.icon} />
                    ) : (
                        <MaterialCommunityIcons name="chevron-double-right" size={28} color={t.icon} />
                    )}
                </Animated.View>
            </View>
        </GestureDetector>
    );
});

const useStyles = makeStyles((th) => ({
    track: { height: H, borderRadius: TRACK_RADIUS, justifyContent: 'center' },
    clip: { borderRadius: TRACK_RADIUS, overflow: 'hidden' },
    trail: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: TRACK_RADIUS },
    labelWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingLeft: KNOB },
    labelRow: { flexDirection: 'row', alignItems: 'center' },
    // keyboard focus ring (web): the violet focus ring from DESIGN.md, offset off the violet track
    focusRing: { outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2, outlineColor: th.colors.brandText },
    knob: {
        position: 'absolute',
        left: PAD,
        width: KNOB,
        height: KNOB,
        borderRadius: KNOB_RADIUS,
        backgroundColor: th.colors.neutral[0], // the knob is white in both modes (it rides the violet track)
        alignItems: 'center',
        justifyContent: 'center',
    },
}));

export default SlideToConfirm;
