/**
 * AddToCartButton — THE key interaction. Fixed width per size, so a grid never jumps.
 *
 *   quantity 0  → surface "ADD" (plain 1px violet border, radius 8, 13/800 violet), small "+" in the corner.
 *                 No offset edge, no shadow (DESIGN.md).
 *   tap         → a solid violet fill grows from the centre (same footprint) while "ADD" shrinks away
 *                 and the white − / + glyphs slide outward; the white count rolls in
 *   −/+         → count rolls (up on increment, down on decrement); light haptic each change
 *   back to 0   → the stepper morphs back into "ADD"
 *   at `max`    → + shakes, warning haptic, `onMaxReached` fires
 *
 * Props
 *   quantity      number (controlled; source of truth is your cart state)
 *   onAdd         () => void  — called from the ADD state (qty 0 → 1)
 *   onIncrement   () => void
 *   onDecrement   () => void
 *   size          'sm' 64×32 (grid cards) | 'md' 80×36 (lists, default) | 'lg' 112×44 (PDP / sticky bars)
 *   max           number — upper limit (optional)
 *   onMaxReached  () => void
 *   disabled      boolean — greyed, no interaction
 *   outOfStock    boolean — greyed "Sold out" (label override: outOfStockLabel)
 *   label         string — ADD label (default 'ADD'), useful for i18n
 *   productName   string — used for accessibility ("Add Amul Milk to cart")
 *   style         outer style (positioning only; size is fixed)
 *
 * Example
 *   <AddToCartButton
 *     size="sm"
 *     quantity={qty}
 *     productName={item.name}
 *     onAdd={() => dispatch(addToCart(item))}
 *     onIncrement={() => dispatch(increment(item.id))}
 *     onDecrement={() => dispatch(decrement(item.id))}
 *   />
 */
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, fontFamily } from '../../constants/theme';
import { useTheme } from '../../theme';
import { springs, durations } from '../../theme/motion';
import { RollingNumber } from './RollingNumber';
import haptics from './haptics';

export const ADD_BUTTON_SIZES = {
    sm: { w: 64, h: 32, font: 13, icon: 16, plus: 9, radius: radii.add },
    md: { w: 80, h: 36, font: 14, icon: 18, plus: 10, radius: radii.add },
    lg: { w: 112, h: 44, font: 16, icon: 20, plus: 11, radius: radii.add },
};

function StepGlyph({ name, size, onPress, side, label, shake, color }) {
    const pressed = useSharedValue(0);
    const anim = useAnimatedStyle(() => ({
        transform: [{ scale: 1 - pressed.value * 0.22 }, { translateX: shake ? shake.value : 0 }],
    }));
    return (
        <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={onPress}
            onPressIn={() => (pressed.value = withSpring(1, springs.snappy))}
            onPressOut={() => (pressed.value = withSpring(0, springs.snappy))}
            hitSlop={{ top: 8, bottom: 8, [side]: 6 }}
            style={styles.half}
            aria-label={label}
        >
            <Animated.View style={anim}>
                <MaterialCommunityIcons name={name} size={size} color={color} />
            </Animated.View>
        </Pressable>
    );
}

export function AddToCartButton({
    quantity = 0,
    onAdd,
    onIncrement,
    onDecrement,
    size = 'md',
    max,
    onMaxReached,
    disabled = false,
    outOfStock = false,
    label = 'ADD',
    outOfStockLabel = 'Sold out',
    productName = 'item',
    style,
}) {
    const sz = ADD_BUTTON_SIZES[size] || ADD_BUTTON_SIZES.md;
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const active = quantity > 0 && !outOfStock;
    const p = useSharedValue(active ? 1 : 0);
    const squish = useSharedValue(1);
    const shake = useSharedValue(0);
    const first = useRef(true);
    // The stepper (two pressables, icons, a RollingNumber) mounts the first time the button turns
    // active and then stays, so the ADD → stepper morph still plays both ways. Most cards in a list
    // are never added, and skipping ~15 idle views per card keeps cell mounts cheap while scrolling.
    const stepperMounted = useRef(active);
    if (active) stepperMounted.current = true;

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        if (reduce) {
            p.value = withTiming(active ? 1 : 0, { duration: durations.fast });
            return;
        }
        p.value = withSpring(active ? 1 : 0, springs.snappy);
        squish.value = withSequence(withSpring(0.94, springs.snappy), withSpring(1, springs.bouncy));
    }, [active, reduce]);

    const fillStyle = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0, 0.35, 1], [0, 1, 1], 'clamp'),
        transform: reduce
            ? []
            : [{ scaleX: interpolate(p.value, [0, 1], [0.55, 1]) }, { scaleY: interpolate(p.value, [0, 1], [0.7, 1]) }],
    }));
    const addStyle = useAnimatedStyle(() => ({
        opacity: interpolate(p.value, [0, 0.5], [1, 0], 'clamp'),
        transform: reduce ? [] : [{ scale: interpolate(p.value, [0, 1], [1, 0.7]) }],
    }));
    const stepperStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.3, 1], [0, 1], 'clamp') }));
    const minusStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: reduce ? 0 : (1 - p.value) * sz.w * 0.28 }],
    }));
    const plusStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: reduce ? 0 : -(1 - p.value) * sz.w * 0.28 }],
    }));
    const outerStyle = useAnimatedStyle(() => ({ transform: [{ scale: squish.value }] }));

    const inactive = disabled || outOfStock;
    const atMax = max != null && quantity >= max;

    const add = () => {
        if (inactive) return;
        haptics.light();
        onAdd && onAdd();
    };
    const inc = () => {
        if (atMax) {
            haptics.warning();
            if (!reduce) {
                shake.value = withSequence(
                    withTiming(-3, { duration: 40 }),
                    withTiming(3, { duration: 60 }),
                    withTiming(-2, { duration: 60 }),
                    withSpring(0, springs.snappy),
                );
            }
            onMaxReached && onMaxReached();
            return;
        }
        haptics.light();
        onIncrement && onIncrement();
    };
    const dec = () => {
        haptics.light();
        onDecrement && onDecrement();
    };

    const onA11yAction = (e) => {
        if (e.nativeEvent.actionName === 'increment') inc();
        if (e.nativeEvent.actionName === 'decrement') dec();
        if (e.nativeEvent.actionName === 'activate') (active ? inc : add)();
    };

    const greyFg = colors.inkDisabled;

    return (
        <Animated.View
            style={[{ width: sz.w, height: sz.h }, outerStyle, style]}
            accessible
            accessibilityRole={active ? 'adjustable' : 'button'}
            accessibilityLabel={
                outOfStock ? `${productName} is ${outOfStockLabel.toLowerCase()}` : active ? `${productName} quantity` : `Add ${productName} to cart`
            }
            accessibilityValue={active ? { text: `${quantity}` } : undefined}
            accessibilityState={{ disabled: inactive }}
            accessibilityActions={
                active
                    ? [{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]
                    : [{ name: 'activate' }]
            }
            onAccessibilityAction={onA11yAction}
        >
            {/* resting outlined surface */}
            <View
                style={[
                    StyleSheet.absoluteFill,
                    styles.outline,
                    {
                        borderRadius: sz.radius,
                        borderColor: inactive ? colors.border : colors.brand,
                        backgroundColor: inactive ? colors.surfaceSunken : colors.surfaceRaised,
                    },
                ]}
            />
            {/* solid violet fill that grows from the centre */}
            <Animated.View
                style={[StyleSheet.absoluteFill, { borderRadius: sz.radius, backgroundColor: colors.brand }, fillStyle, { pointerEvents: 'none' }]}
            />

            {/* ADD state */}
            <Animated.View style={[StyleSheet.absoluteFill, addStyle, { pointerEvents: active ? 'none' : 'auto' }]}>
                <Pressable
                    accessible={false}
                    onPress={add}
                    disabled={inactive || active}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    style={styles.center}
                >
                    <RNText
                        allowFontScaling={false}
                        numberOfLines={1}
                        style={[
                            styles.addText,
                            { fontSize: outOfStock ? sz.font - 2 : sz.font, color: inactive ? greyFg : colors.brandText },
                        ]}
                    >
                        {outOfStock ? outOfStockLabel : label}
                    </RNText>
                </Pressable>
                {!inactive ? (
                    <RNText
                        allowFontScaling={false}
                        style={[styles.plus, { fontSize: sz.plus + 3, lineHeight: sz.plus + 4, color: colors.brandText }, { pointerEvents: 'none' }]}
                    >
                        +
                    </RNText>
                ) : null}
            </Animated.View>

            {/* Stepper state */}
            {stepperMounted.current ? (
                <Animated.View style={[StyleSheet.absoluteFill, styles.row, stepperStyle, { pointerEvents: active ? 'box-none' : 'none' }]}>
                    <Animated.View style={[styles.side, minusStyle]}>
                        <StepGlyph name="minus" size={sz.icon} onPress={dec} side="left" label="Decrease quantity" color={colors.onBrand} />
                    </Animated.View>
                    <View style={[styles.count, { pointerEvents: 'none' }]}>
                        <RollingNumber
                            value={Math.max(quantity, 1)}
                            variant="counter"
                            color={colors.onBrand}
                            style={{ fontSize: sz.font, fontFamily: fontFamily.extrabold }}
                        />
                    </View>
                    <Animated.View style={[styles.side, plusStyle]}>
                        <StepGlyph name="plus" size={sz.icon} onPress={inc} side="right" label="Increase quantity" shake={shake} color={colors.onBrand} />
                    </Animated.View>
                </Animated.View>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    outline: { borderWidth: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    addText: { fontFamily: fontFamily.extrabold, letterSpacing: 0, fontVariant: ['tabular-nums'] },
    plus: { position: 'absolute', top: 1, right: 5, fontFamily: fontFamily.bold },
    row: { flexDirection: 'row', alignItems: 'stretch' },
    side: { flex: 1 },
    half: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    count: { alignItems: 'center', justifyContent: 'center', minWidth: 18 },
});

export default AddToCartButton;
