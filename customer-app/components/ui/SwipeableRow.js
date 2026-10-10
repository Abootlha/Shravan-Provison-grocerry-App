/**
 * SwipeableRow — swipe left to reveal a destructive action (cart items, saved addresses, recent
 * searches). Gesture runs on the UI thread (gesture-handler + Reanimated):
 *   drag left        row follows the finger; the red action panel is revealed underneath and its
 *                    icon scales up as you approach the threshold
 *   past the action  release → snaps OPEN (spring), showing the tappable action
 *   past fullSwipe   selection haptic at the threshold; release → the row slides out and onAction fires
 *   flick            velocity < -900 px/s counts as a full swipe
 *   drag right       friction (rubber band), snaps closed
 * Vertical scroll wins (the pan fails after 8px of vertical travel), so lists still scroll.
 *
 * Props
 *   onAction       () => void — called when the action is confirmed (remove the item from state; wrap
 *                  the list item in <Animated.View layout={layout.list} exiting={layout.exit}> so
 *                  neighbours slide up)
 *   actionLabel    string (default 'Delete')
 *   actionIcon     MaterialCommunityIcons name (default 'trash-can-outline')
 *   actionColor    panel colour (default colors.error) · actionInk (default colors.onError)
 *   actionWidth    px of the revealed panel (default 88)
 *   fullSwipe      fraction of the row width that commits without tapping (default 0.5; false to disable)
 *   enabled        default true
 *   radius         corner radius of the row (default 0) — clips the panel to the row's shape
 *   style          outer style (margins); the CHILD must paint its own background (e.g. a Card / surface row)
 *   accessibilityActionLabel  label for the screen-reader action (default actionLabel)
 *
 * Accessibility: exposes a custom action (VoiceOver rotor / TalkBack actions) so no swipe is needed.
 * Reduced motion: snaps with timing instead of springs.
 *
 * Example
 *   <Animated.View layout={layout.list} exiting={layout.exit}>
 *     <SwipeableRow onAction={() => dispatch(removeFromCart(item.id))} radius={radii.md}>
 *       <CartRow item={item} />
 *     </SwipeableRow>
 *   </Animated.View>
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type } from '../../constants/theme';
import { springs, durations, easings } from '../../theme/motion';
import { useTheme } from '../../theme';
import haptics from './haptics';

export function SwipeableRow({
    onAction,
    actionLabel = 'Delete',
    actionIcon = 'trash-can-outline',
    actionColor,
    actionInk,
    actionWidth = 88,
    fullSwipe = 0.5,
    enabled = true,
    radius = 0,
    style,
    children,
    accessibilityActionLabel,
}) {
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const [w, setW] = useState(0);
    const x = useSharedValue(0);
    const start = useSharedValue(0);
    const armed = useSharedValue(false);
    const bg = actionColor || colors.error;
    const ink = actionInk || colors.onError;
    const fullAt = fullSwipe && w ? -w * fullSwipe : -Infinity;

    const go = (to, cb) => {
        'worklet';
        x.value = reduce ? withTiming(to, { duration: durations.fast, easing: easings.out }, cb) : withSpring(to, springs.drag, cb);
    };

    const commit = () => {
        haptics.light();
        onAction && onAction();
    };
    // JS-side bookkeeping so a tap that ends a drag (or taps an open row) never reaches the
    // row's own pressables: on native RNGH cancels the JS responder when the pan activates;
    // on web the click is swallowed in the capture phase below.
    const draggedAt = useRef(0);
    const open = useRef(false);
    const markDrag = () => {
        draggedAt.current = Date.now();
    };
    const setOpen = (v) => {
        open.current = v;
    };
    const close = () => {
        open.current = false;
        go(0);
    };
    const content = useRef(null);
    const swallow = (e) => {
        if (Date.now() - draggedAt.current < 350 || open.current) {
            e.stopPropagation();
            e.preventDefault?.();
            if (open.current && Date.now() - draggedAt.current >= 350) close();
        }
    };
    const guardTouch = () => Platform.OS !== 'web' && (open.current || Date.now() - draggedAt.current < 350);
    const releaseGuard = () => {
        if (open.current && Date.now() - draggedAt.current >= 350) close();
    };
    // RN-web only forwards bubble-phase onClick, so attach the capture listener to the DOM node.
    useEffect(() => {
        const node = content.current;
        if (Platform.OS !== 'web' || !node || typeof node.addEventListener !== 'function') return undefined;
        node.addEventListener('click', swallow, true);
        return () => node.removeEventListener('click', swallow, true);
    }, []);

    // A plain JS function for worklets to schedule. `haptics` is a function object with methods attached;
    // captured into a worklet it becomes a remote function without those properties, so
    // `haptics.selection` was undefined on the UI runtime and scheduleOnRN(undefined) aborted the app.
    const selectionTick = () => haptics.selection();
    const pan = Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-10, 10])
        .failOffsetY([-8, 8])
        .onBegin(() => {
            start.value = x.value;
        })
        .onStart(() => {
            scheduleOnRN(markDrag);
        })
        .onUpdate((e) => {
            const next = start.value + e.translationX;
            x.value = next > 0 ? next * 0.15 : next; // rubber band to the right
            const over = x.value < fullAt;
            if (over !== armed.value) {
                armed.value = over;
                scheduleOnRN(selectionTick);
            }
        })
        .onEnd((e) => {
            if (x.value < fullAt || (fullSwipe && e.velocityX < -900 && x.value < -actionWidth * 0.5)) {
                armed.value = false;
                x.value = withTiming(-w - 24, { duration: durations.base, easing: easings.out }, (done) => {
                    if (done) scheduleOnRN(commit);
                });
            } else if (x.value < -actionWidth * 0.5) {
                go(-actionWidth);
                scheduleOnRN(setOpen, true);
            } else {
                go(0);
                scheduleOnRN(setOpen, false);
            }
        });

    const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
    // the panel only exists while the row is displaced, so translucent dividers / antialiased
    // corners never show a red fringe at rest
    const panelStyle = useAnimatedStyle(() => ({ opacity: x.value < -0.5 ? 1 : 0 }));
    const iconStyle = useAnimatedStyle(() => {
        const p = interpolate(x.value, [0, -actionWidth], [0, 1], 'clamp');
        return { opacity: p, transform: [{ scale: 0.7 + 0.3 * p + (armed.value ? 0.12 : 0) }] };
    });

    return (
        <View
            onLayout={(e) => setW(e.nativeEvent.layout.width)}
            style={[styles.wrap, { borderRadius: radius }, style]}
            accessibilityActions={[{ name: 'delete', label: accessibilityActionLabel || actionLabel }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && commit()}
        >
            <Animated.View style={[StyleSheet.absoluteFill, styles.panel, { backgroundColor: bg, borderRadius: radius }, panelStyle]}>
                <Pressable
                    onPress={() => {
                        go(-w - 24);
                        setTimeout(commit, durations.fast);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                    style={[styles.action, { width: actionWidth }]}
                >
                    <Animated.View style={[styles.actionInner, iconStyle]}>
                        <MaterialCommunityIcons name={actionIcon} size={22} color={ink} />
                        <RNText style={[type.micro, styles.actionText, { color: ink }]} numberOfLines={1}>
                            {actionLabel}
                        </RNText>
                    </Animated.View>
                </Pressable>
            </Animated.View>
            <GestureDetector gesture={pan}>
                <Animated.View style={rowStyle}>
                    <View
                        ref={content}
                        // Native: while the row is open (or a drag just ended), claim the touch in the
                        // capture phase so the row's own pressables never see it — the tap only closes
                        // the row (mirrors the web click swallow above). The pan still works because
                        // RNGH gestures don't go through the JS responder system.
                        onStartShouldSetResponderCapture={guardTouch}
                        onResponderRelease={releaseGuard}
                        onResponderTerminationRequest={() => true}
                    >
                        {children}
                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { overflow: 'hidden' },
    panel: { alignItems: 'flex-end', justifyContent: 'center' },
    action: { height: '100%', alignItems: 'center', justifyContent: 'center' },
    actionInner: { alignItems: 'center' },
    actionText: { marginTop: 2 },
});

export default SwipeableRow;
