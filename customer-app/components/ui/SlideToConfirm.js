/**
 * SlideToConfirm — Swiggy-style slide-to-pay. Drag the white knob to the end to confirm.
 * Released early → springs back. A quick flick past 40% also confirms (velocity aware).
 * After confirming, the knob stays at the end and shows a spinner while `loading`.
 *
 * Props
 *   label           string — e.g. "Slide to pay ₹248" (static text + a static chevron hint; no shimmer loop)
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
 * to confirm — no dragging required. Haptics: selection tick when crossing the threshold,
 * success on confirm.
 *
 * Example
 *   const slider = useRef(null);
 *   <SlideToConfirm ref={slider} label={`Slide to pay ₹${total}`} loading={paying}
 *     onConfirm={async () => { try { await pay(); } catch (e) { slider.current.reset(); } }} />
 */
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
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
    { label, confirmedLabel = 'Processing…', onConfirm, loading, disabled = false, tone = 'accent', style },
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
        crossed.value = false;
        x.value = withSpring(0, springs.drag);
    };
    useImperativeHandle(ref, () => ({ reset }), []);

    const confirm = () => {
        if (done) return;
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
        })
        .onUpdate((e) => {
            const nx = Math.min(Math.max(start.value + e.translationX, 0), max);
            x.value = nx;
            const over = nx > max * THRESH;
            if (over !== crossed.value) {
                crossed.value = over;
                scheduleOnRN(selectionTick);
            }
        })
        .onEnd((e) => {
            if (x.value > max * THRESH || (e.velocityX > 900 && x.value > max * 0.4)) {
                x.value = withSpring(max, springs.snappy);
                scheduleOnRN(confirm);
            } else {
                crossed.value = false;
                x.value = withSpring(0, springs.drag);
            }
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
    const chevronStyle = useAnimatedStyle(() => ({
        opacity: max ? interpolate(x.value, [0, max], [1, 0.4], 'clamp') : 1,
    }));

    const busy = done && loading !== false;

    return (
        <View
            accessible
            // RN-web renders role="button" as a <button>, which never reports onLayout and
            // swallows the drag; expose it as a slider there instead.
            accessibilityRole={Platform.OS === 'web' ? 'adjustable' : 'button'}
            accessibilityLabel={done ? confirmedLabel : label}
            accessibilityHint="Swipe right, or double tap, to confirm"
            accessibilityState={{ disabled, busy }}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'activate' && !disabled && confirm()}
            onLayout={(e) => setW(e.nativeEvent.layout.width)}
            style={[styles.track, { backgroundColor: t.track, opacity: disabled ? 0.45 : 1 }, style]}
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
                            {label}
                        </Animated.Text>
                        <Animated.View style={[styles.trailingChevrons, chevronStyle]}>
                            <MaterialCommunityIcons name="chevron-double-right" size={18} color={t.fg} style={{ opacity: 0.7 }} />
                        </Animated.View>
                    </Animated.View>
                )}
            </View>

            <GestureDetector gesture={pan}>
                <Animated.View style={[styles.knob, WEB_DRAG, knobStyle]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {busy ? (
                        <ActivityIndicator color={t.icon} />
                    ) : done ? (
                        <MaterialCommunityIcons name="check-bold" size={24} color={t.icon} />
                    ) : (
                        <MaterialCommunityIcons name="chevron-double-right" size={28} color={t.icon} />
                    )}
                </Animated.View>
            </GestureDetector>
        </View>
    );
});

const useStyles = makeStyles((th) => ({
    track: { height: H, borderRadius: TRACK_RADIUS, justifyContent: 'center' },
    clip: { borderRadius: TRACK_RADIUS, overflow: 'hidden' },
    trail: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: TRACK_RADIUS },
    labelWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingLeft: KNOB },
    labelRow: { flexDirection: 'row', alignItems: 'center' },
    trailingChevrons: { marginLeft: 6 },
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
