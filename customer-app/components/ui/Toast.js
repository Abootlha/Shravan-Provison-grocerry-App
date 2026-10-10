/**
 * Toast — Sonner-style imperative toasts. Mount <ToastHost /> once (App.js already does),
 * then call `toast.*` from anywhere (components, thunks, services).
 *
 *   import { toast } from '../components/ui';
 *   toast.show({ message: 'Added to wishlist', action: { label: 'View', onPress: openWishlist } });
 *   toast.success('Address saved');
 *   toast.error('Payment failed', { description: 'No money was deducted.' });
 *   toast.info('Store closes at 11 PM');
 *   toast.hide();
 *
 * toast.show(options)
 *   message      string (required)
 *   description  string — second line
 *   tone         'default' | 'success' | 'error' | 'info'
 *   icon         element — overrides the tone icon
 *   action       { label, onPress } — light-violet text button on the right (closes the toast)
 *   duration     ms (default 2800; 0 = until dismissed)
 *   bottomOffset number — extra lift for this toast (e.g. above a sticky CTA)
 *
 * <ToastHost bottomOffset={88} />  — default lift clears the floating tab bar.
 *
 * Behaviour: springs up from the bottom; exits down faster than it enters; a new toast
 * replaces the current one (cross-slide); swipe down (or flick) to dismiss; light haptic
 * on success, error haptic on error. Screen readers get a polite live-region announcement.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text as RNText, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors as staticColors, radii, space, type, z } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { springs, durations, easings } from '../../theme/motion';
import { PressableScale } from './PressableScale';
import haptics from './haptics';

let emit = null;
let seq = 0;

export const toast = {
    show(options) {
        const t = typeof options === 'string' ? { message: options } : options || {};
        const id = ++seq;
        if (emit) emit({ type: 'show', toast: { tone: 'default', duration: durations.toast, ...t, id } });
        return id;
    },
    success(message, opts) {
        return toast.show({ ...opts, message, tone: 'success' });
    },
    error(message, opts) {
        return toast.show({ ...opts, message, tone: 'error' });
    },
    info(message, opts) {
        return toast.show({ ...opts, message, tone: 'info' });
    },
    hide(id) {
        if (emit) emit({ type: 'hide', id });
    },
};

// Solid dark surface (ink #151515 light / raised #232323 + hairline dark). No blur (DESIGN.md).
// The action link on the dark toast: the lifted brand text violet (6.9:1 on #151515, 5.8:1 on #232323).
const ACTION_INK = '#A68BFF';

// Icons sit on the dark toast surface in BOTH modes, so they use fixed light tints.
const TONE_ICON = {
    success: { name: 'check-circle', color: '#4CC26A' },
    error: { name: 'alert-circle', color: '#FF8A80' },
    info: { name: 'information', color: staticColors.night[200] },
};

function ToastCard({ data, leaving, onHidden, onDismiss }) {
    const reduce = useReducedMotion();
    const { colors } = useTheme();
    const styles = useStyles();
    const y = useSharedValue(reduce ? 0 : 90);
    const o = useSharedValue(0);
    const drag = useSharedValue(0);

    useEffect(() => {
        if (!leaving) {
            o.value = withTiming(1, { duration: durations.fast, easing: easings.out });
            y.value = withSpring(0, springs.sheet);
        } else {
            o.value = withTiming(0, { duration: durations.fast });
            y.value = withTiming(reduce ? 0 : 70, { duration: durations.base, easing: easings.out }, (f) => {
                if (f) scheduleOnRN(onHidden);
            });
        }
    }, [leaving]);

    const pan = Gesture.Pan()
        .activeOffsetY([-6, 6])
        .onUpdate((e) => {
            drag.value = e.translationY > 0 ? e.translationY : e.translationY * 0.2; // friction upwards
        })
        .onEnd((e) => {
            if (drag.value > 36 || e.velocityY > 600) {
                scheduleOnRN(onDismiss);
            } else {
                drag.value = withSpring(0, springs.drag);
            }
        });

    const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value + drag.value }] }));
    const tone = TONE_ICON[data.tone];

    return (
        <GestureDetector gesture={pan}>
            <Animated.View
                style={[styles.card, anim, { pointerEvents: leaving ? 'none' : 'auto' }]}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
            >
                {data.icon ? (
                    <View style={styles.icon}>{data.icon}</View>
                ) : tone ? (
                    <MaterialCommunityIcons name={tone.name} size={22} color={tone.color} style={styles.icon} />
                ) : null}
                <View style={styles.texts}>
                    <RNText style={[type.bodyStrong, { color: colors.onNight }]} numberOfLines={2}>
                        {data.message}
                    </RNText>
                    {data.description ? (
                        <RNText style={[type.caption, { color: colors.onNightSecondary, marginTop: 2 }]} numberOfLines={2}>
                            {data.description}
                        </RNText>
                    ) : null}
                </View>
                {data.action ? (
                    <PressableScale
                        onPress={() => {
                            data.action.onPress && data.action.onPress();
                            onDismiss();
                        }}
                        haptic="light"
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                        style={styles.action}
                        accessibilityLabel={data.action.label}
                    >
                        <RNText style={[type.label, { color: ACTION_INK, fontFamily: type.button.fontFamily }]}>
                            {data.action.label}
                        </RNText>
                    </PressableScale>
                ) : null}
            </Animated.View>
        </GestureDetector>
    );
}

export function ToastHost({ bottomOffset = 88 }) {
    const insets = useSafeAreaInsets();
    const styles = useStyles();
    const [state, setState] = useState({ current: null, leaving: [] });
    const timer = useRef(null);

    const hide = useCallback((id) => {
        setState((s) => {
            if (!s.current || (id != null && s.current.id !== id)) return s;
            return { current: null, leaving: [...s.leaving, s.current] };
        });
    }, []);

    useEffect(() => {
        emit = (evt) => {
            if (evt.type === 'show') {
                const t = evt.toast;
                if (t.tone === 'success') haptics.light();
                if (t.tone === 'error') haptics.error();
                setState((s) => ({ current: t, leaving: s.current ? [...s.leaving, s.current] : s.leaving }));
                clearTimeout(timer.current);
                if (t.duration) timer.current = setTimeout(() => hide(t.id), t.duration);
            } else if (evt.type === 'hide') {
                hide(evt.id);
            }
        };
        return () => {
            emit = null;
            clearTimeout(timer.current);
        };
    }, [hide]);

    const removeLeaving = (id) => setState((s) => ({ ...s, leaving: s.leaving.filter((t) => t.id !== id) }));
    // Each toast keeps its own lift while it leaves, so a leaving toast never drops to the default
    // offset (e.g. down over a sticky pay bar) once `current` is cleared.
    const liftOf = (t) => insets.bottom + (t.bottomOffset ?? bottomOffset);

    return (
        <View style={[styles.host, { pointerEvents: 'box-none' }]}>
            {/* one flat keyed list so a toast keeps its instance (and position) when it starts leaving */}
            {[...state.leaving.map((t) => [t, true]), ...(state.current ? [[state.current, false]] : [])].map(([t, leaving]) => (
                <View key={t.id} style={[styles.layer, { bottom: liftOf(t) }, { pointerEvents: leaving ? 'none' : 'box-none' }]}>
                    <ToastCard
                        data={t}
                        leaving={leaving}
                        onHidden={() => removeLeaving(t.id)}
                        onDismiss={() => hide(t.id)}
                    />
                </View>
            ))}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    host: { position: 'absolute', left: space.lg, right: space.lg, bottom: 0, zIndex: z.toast, elevation: 30 },
    layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.colors.surfaceNight,
        borderRadius: radii.card,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.colors.glassBorderNight,
        paddingVertical: space.md + 2,
        paddingHorizontal: space.lg,
        minHeight: 52,
        ...t.shadows.floating,
    },
    icon: { marginRight: space.md },
    texts: { flex: 1 },
    action: { marginLeft: space.md, paddingVertical: space.xs },
}));

export default ToastHost;
