/**
 * BottomSheet — controlled sheet built on Reanimated + Gesture Handler (UI thread).
 * Springs open (springs.sheet), exits faster (220ms ease-out), drag down to dismiss
 * (distance OR flick velocity), rubber-band friction when dragged up, scrim fades with
 * the sheet position, lifts above the keyboard on iOS/Android, Android back closes it.
 * Rendered in an RN <Modal>, so it always sits above tabs and headers. No provider needed.
 *
 * Props
 *   visible        boolean (controlled)
 *   onClose        () => void — fires on any user dismissal (drag, scrim tap, back button,
 *                  close button). Set your `visible` state to false in it.
 *   title          string — renders a <SheetHeader> with a close button
 *   subtitle       string
 *   floating       boolean — Shop-style detached card: 12pt side margins, all corners rounded,
 *                  lifted off the bottom edge (default false = edge-to-edge, top corners rounded)
 *   scrollable     boolean — content scrolls inside the sheet (long lists); dragging then only
 *                  works from the handle/header so it doesn't fight the scroll
 *   dismissible    boolean — allow drag/scrim/back to close (default true)
 *   blurScrim      @deprecated — ignored; the scrim is always a flat dim (no blur, DESIGN.md)
 *   footer         element pinned under the content (e.g. a full-width Button)
 *   maxHeight      number — cap (default: screen height minus top inset minus 24)
 *   contentStyle   style for the content container (default horizontal padding 16)
 *   children
 *
 * Example
 *   <BottomSheet visible={open} onClose={() => setOpen(false)} title="Delivery instructions" floating
 *     footer={<Button label="Save" fullWidth onPress={save} />}>
 *     <SheetTextInput placeholder="e.g. Ring the bell" style={...} />
 *   </BottomSheet>
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    useAnimatedKeyboard,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, space } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { springs, durations, easings } from '../../theme/motion';
import { SheetHeader } from './SectionHeader';

/** Inputs inside a sheet: a plain TextInput (the sheet itself lifts above the keyboard). */
export const SheetTextInput = TextInput;
/** Scroll container for custom long content inside a sheet. */
export const SheetScrollView = ScrollView;

const FLOAT_MARGIN = 12; // side margins of the floating variant
const FLOAT_GAP = 16; // lift of the floating variant above the bottom safe area
const OFFSCREEN = 2000;

// useAnimatedKeyboard is native-only; Platform.OS never changes at runtime, so this is hook-safe.
function useKeyboardHeightWeb() {
    return useSharedValue(0);
}
function useKeyboardHeightNative() {
    return useAnimatedKeyboard().height;
}
const useKeyboardHeight = Platform.OS === 'web' ? useKeyboardHeightWeb : useKeyboardHeightNative;

export function BottomSheet({
    visible,
    onClose,
    title,
    subtitle,
    floating = false,
    scrollable = false,
    dismissible = true,
    blurScrim, // eslint-disable-line no-unused-vars -- deprecated, ignored
    footer,
    maxHeight,
    contentStyle,
    children,
}) {
    const insets = useSafeAreaInsets();
    const styles = useStyles();
    const { height: winH } = useWindowDimensions();
    const reduce = useReducedMotion();
    const kb = useKeyboardHeight();
    const [mounted, setMounted] = useState(visible);
    const h = useSharedValue(0);
    const y = useSharedValue(OFFSCREEN);
    const start = useSharedValue(0);
    const opened = useRef(false);
    const closing = useRef(false);

    const finishClose = () => {
        closing.current = false;
        opened.current = false;
        setMounted(false);
    };

    const animateOut = (notify) => {
        if (closing.current) return;
        closing.current = true;
        const target = (h.value || 600) + 40;
        y.value = withTiming(target, { duration: durations.base, easing: easings.out }, (done) => {
            if (done) scheduleOnRN(finishClose);
        });
        if (notify && onClose) onClose();
    };

    useEffect(() => {
        if (visible) {
            closing.current = false;
            if (!mounted) {
                y.value = OFFSCREEN;
                setMounted(true);
            } else if (opened.current) {
                y.value = withSpring(0, springs.sheet);
            }
        } else if (mounted) {
            animateOut(false);
        }
    }, [visible]);

    const onSheetLayout = (e) => {
        h.value = e.nativeEvent.layout.height;
        if (!opened.current && visible) {
            opened.current = true;
            y.value = h.value + 40;
            y.value = reduce
                ? withTiming(0, { duration: durations.base, easing: easings.out })
                : withSpring(0, springs.sheet);
        }
    };

    const requestClose = () => {
        if (dismissible) animateOut(true);
    };

    const pan = Gesture.Pan()
        .enabled(dismissible)
        .activeOffsetY([-6, 6])
        .onBegin(() => {
            start.value = y.value;
        })
        .onUpdate((e) => {
            const next = start.value + e.translationY;
            y.value = next >= 0 ? next : next * 0.2; // friction when pulled up
        })
        .onEnd((e) => {
            if (y.value > h.value * 0.3 || e.velocityY > 900) {
                scheduleOnRN(requestClose);
            } else {
                y.value = withSpring(0, springs.drag);
            }
        });

    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value - kb.value }] }));
    const scrimStyle = useAnimatedStyle(() => ({
        opacity: h.value ? interpolate(y.value, [0, h.value], [1, 0], 'clamp') : 0,
    }));

    if (!mounted) return null;

    const cap = maxHeight || winH - insets.top - space['2xl'];
    const bottomPad = floating ? space.lg : Math.max(insets.bottom, space.lg);

    const header = (
        <View style={styles.headerPad}>
            <View style={styles.handleWrap}>
                <View style={styles.handle} />
            </View>
            {title ? <SheetHeader title={title} subtitle={subtitle} onClose={dismissible ? requestClose : undefined} /> : null}
        </View>
    );

    const sheet = (
        <Animated.View
            onLayout={onSheetLayout}
            accessibilityViewIsModal
            style={[
                styles.sheet,
                floating ? styles.floating : styles.edge,
                { maxHeight: cap, bottom: floating ? insets.bottom + FLOAT_GAP : 0 },
                sheetStyle,
            ]}
        >
            {scrollable ? <GestureDetector gesture={pan}>{header}</GestureDetector> : header}
            <View style={[styles.content, contentStyle, scrollable && styles.shrink]}>
                {scrollable ? (
                    <ScrollView style={styles.shrink} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {children}
                    </ScrollView>
                ) : (
                    children
                )}
                {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
            <View style={{ height: bottomPad }} />
        </Animated.View>
    );

    return (
        <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
            <GestureHandlerRootView style={styles.root}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={requestClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close sheet"
                    />
                </Animated.View>
                {scrollable ? sheet : <GestureDetector gesture={pan}>{sheet}</GestureDetector>}
            </GestureHandlerRootView>
        </Modal>
    );
}

const useStyles = makeStyles((t) => ({
    root: { flex: 1 },
    scrim: { backgroundColor: t.colors.scrim },
    scrimLight: { backgroundColor: t.colors.scrimLight },
    // dark: the sheet is the raised layer, with a lit hairline so its top edge reads against the scrim
    sheet: {
        position: 'absolute',
        backgroundColor: t.colors.surfaceRaised,
        overflow: 'hidden',
        ...t.shadows.floating,
        ...(t.isDark ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.colors.hairline } : null),
    },
    edge: { left: 0, right: 0, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet },
    floating: { left: FLOAT_MARGIN, right: FLOAT_MARGIN, borderRadius: radii.sheet },
    handleWrap: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md },
    handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: t.colors.borderStrong },
    headerPad: { paddingHorizontal: space.lg },
    content: { paddingHorizontal: space.lg },
    shrink: { flexShrink: 1 },
    footer: { marginTop: space.lg },
}));

export default BottomSheet;
