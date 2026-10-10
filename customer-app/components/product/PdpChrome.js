/**
 * PDP chrome (Part C §8)
 *
 *   PdpHeader     glass back / share / heart buttons floating over the hero image; a solid
 *                 titled bar solidifies behind them as the hero scrolls away (useCollapsibleHeader
 *                 driven by the screen's scroll offset, shifted to start at `fadeStart`).
 *                 The heart pops with a small particle burst (HeartBurst) when saving.
 *   PdpBottomBar  sticky footer. Not in cart: price + "Add to cart" (52px violet, r10).
 *                 In cart: it morphs into a brand-tint − n + stepper + "View cart · ₹total".
 *                 Morph timing (Emil): the new slot enters with a 160 ms fade + snappy spring rise,
 *                 the old one leaves in 90 ms (exit faster than entrance, nothing over 300 ms, no
 *                 ease-in), so the swap reads as one control changing state. The CTA is also the
 *                 PDP's fly-to-cart target (priority 1): the pack shot lands in it and it bumps.
 *                 On enter the footer slides up from below the screen edge (sheet spring, after a
 *                 short beat so the hero flight reads first); reduced motion: a fade.
 *
 * Dark: the bars sit on surfaceRaised (white in light, the raised layer in dark) with the floating
 * shadow, so they separate from the sheet below, which is `surface`. No lit edges, no glow.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useDerivedValue,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton, Text, PressableScale, PriceTag, RollingNumber, haptic, useCartTarget, useCollapsibleHeader } from '../ui';
import { radii, space, z } from '../../constants/theme';
import { useTheme, makeStyles } from '../../theme';
import HeartBurst from './HeartBurst';
import { springs, durations, easings, press } from '../../theme/motion';

const CTA_HEIGHT = 52;
const LEFT_SLOT = 132;
const ENTER_DELAY = 120; // ms: let the hero flight lead, then the footer arrives

export const PdpHeader = memo(function PdpHeader({ scrollY, fadeStart, fadeEnd, topInset, title, wishlisted, onBack, onShare, onWishlist }) {
    const styles = useStyles();
    const { colors } = useTheme();
    // The collapsible-header curves, started where the hero begins to leave instead of at 0.
    const shifted = useDerivedValue(() => scrollY.value - fadeStart);
    const collapse = useCollapsibleHeader({ scrollY: shifted, range: Math.max(fadeEnd - fadeStart, 1) });
    const burst = useRef(null);
    const heart = () => {
        if (!wishlisted) burst.current?.fire();
        onWishlist?.();
    };
    return (
        <View style={[styles.header, { paddingTop: topInset + space.sm }, { pointerEvents: 'box-none' }]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.headerBg, collapse.barStyle, { pointerEvents: 'none' }]} />
            <Animated.View style={[styles.hairline, collapse.hairlineStyle, { pointerEvents: 'none' }]} />
            <IconButton name="arrow-left" variant="glass" onPress={onBack} accessibilityLabel="Go back" />
            <Animated.View style={[styles.titleWrap, collapse.compactTitleStyle, { pointerEvents: 'none' }]}>
                <Text variant="title" numberOfLines={1}>
                    {title}
                </Text>
            </Animated.View>
            <View style={styles.right}>
                <IconButton name="share-variant-outline" variant="glass" onPress={onShare} accessibilityLabel={`Share ${title}`} />
                <View>
                    <HeartBurst ref={burst} size={34} />
                    <IconButton
                        name={wishlisted ? 'heart' : 'heart-outline'}
                        variant="glass"
                        active={wishlisted}
                        activeColor={colors.error}
                        haptic={wishlisted ? 'light' : 'medium'}
                        onPress={heart}
                        accessibilityLabel={wishlisted ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
                    />
                </View>
            </View>
        </View>
    );
});

// Footer slots swap with a short rise + fade; exits are quicker than entrances.
const slotIn = () => {
    'worklet';
    return {
        initialValues: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.96 }] },
        animations: {
            opacity: withTiming(1, { duration: durations.fast }),
            transform: [{ translateY: withSpring(0, springs.snappy) }, { scale: withSpring(1, springs.snappy) }],
        },
    };
};
const slotOut = () => {
    'worklet';
    return {
        initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
        animations: {
            opacity: withTiming(0, { duration: durations.instant, easing: easings.out }),
            transform: [{ translateY: withTiming(-6, { duration: durations.instant, easing: easings.out }) }],
        },
    };
};

// Custom layout-animation worklets are native-only; Reanimated web supports only the presets.
const WEB = Platform.OS === 'web';
const SLOT_IN = WEB ? FadeIn.duration(durations.fast) : slotIn;
const SLOT_OUT = WEB ? FadeOut.duration(durations.instant) : slotOut;

function Stepper({ quantity, productName, onIncrement, onDecrement }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const dec = () => {
        haptic.light();
        onDecrement?.();
    };
    const inc = () => {
        haptic.light();
        onIncrement?.();
    };
    return (
        <View
            style={styles.stepper}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`${productName}, ${quantity} in cart`}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? inc() : dec())}
        >
            <PressableScale onPress={dec} scaleTo={press.deep} style={styles.stepBtn} accessibilityLabel={`Remove one ${productName}`}>
                <MaterialCommunityIcons name={quantity === 1 ? 'trash-can-outline' : 'minus'} size={20} color={colors.brandStrong} />
            </PressableScale>
            <RollingNumber value={quantity} variant="priceLarge" color={colors.brandStrong} />
            <PressableScale onPress={inc} scaleTo={press.deep} style={styles.stepBtn} accessibilityLabel={`Add one more ${productName}`}>
                <MaterialCommunityIcons name="plus" size={20} color={colors.brandStrong} />
            </PressableScale>
        </View>
    );
}

export const PdpBottomBar = memo(function PdpBottomBar({
    price,
    mrp,
    quantity,
    inStock,
    bottomInset,
    productName,
    isHi,
    onAdd,
    onIncrement,
    onDecrement,
    onViewCart,
}) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    // Slide up from below the screen edge once, on mount.
    const enter = useSharedValue(0);
    useEffect(() => {
        enter.value = reduce
            ? withTiming(1, { duration: durations.base, easing: easings.out })
            : withDelay(ENTER_DELAY, withSpring(1, springs.sheet));
    }, []);
    const enterStyle = useAnimatedStyle(() => ({
        opacity: reduce ? enter.value : Math.min(1, enter.value * 3),
        transform: [{ translateY: reduce ? 0 : (1 - enter.value) * 120 }],
    }));
    const inCart = quantity > 0;
    const mode = !inStock ? 'oos' : inCart ? 'cart' : 'add';
    const ctaRef = useRef(null);
    const bump = useCartTarget(ctaRef, { priority: 1, enabled: inStock });
    const add = () => {
        haptic.light();
        onAdd?.();
    };

    let ctaLabel;
    let ctaAction;
    if (mode === 'oos') ctaLabel = isHi ? 'स्टॉक में नहीं' : 'Out of stock';
    else if (mode === 'add') {
        ctaLabel = isHi ? 'कार्ट में जोड़ें' : 'Add to cart';
        ctaAction = add;
    } else {
        ctaLabel = isHi ? 'कार्ट देखें' : 'View cart';
        ctaAction = onViewCart;
    }

    return (
        <Animated.View style={[styles.bar, { paddingBottom: Math.max(bottomInset, space.md) }, enterStyle]}>
            <View style={styles.left}>
                {mode === 'cart' ? (
                    <Animated.View key="stepper" entering={SLOT_IN} exiting={SLOT_OUT}>
                        <Stepper quantity={quantity} productName={productName} onIncrement={onIncrement} onDecrement={onDecrement} />
                    </Animated.View>
                ) : (
                    <Animated.View key="price" entering={SLOT_IN} exiting={SLOT_OUT}>
                        <PriceTag price={price} mrp={mrp} size="md" layout="row" />
                        <Text variant="caption" color="muted" numberOfLines={1}>
                            {isHi ? 'सभी कर शामिल' : 'Incl. of all taxes'}
                        </Text>
                    </Animated.View>
                )}
            </View>
            <Animated.View ref={ctaRef} collapsable={false} style={[styles.ctaWrap, bump]}>
            <PressableScale
                onPress={ctaAction}
                disabled={mode === 'oos'}
                disabledOpacity={1}
                haptic={mode === 'cart' ? 'light' : undefined}
                scaleTo={press.scale}
                style={[styles.cta, mode === 'oos' ? styles.ctaOff : styles.ctaOn]}
                accessibilityRole="button"
                accessibilityLabel={mode === 'add' ? `Add ${productName} to cart` : ctaLabel}
            >
                <Animated.View key={mode} entering={SLOT_IN} exiting={SLOT_OUT} style={styles.ctaInner}>
                    {mode === 'add' ? <MaterialCommunityIcons name="shopping-outline" size={20} color={colors.onBrand} /> : null}
                    <Text variant="button" color={mode === 'oos' ? 'muted' : 'onBrand'} numberOfLines={1}>
                        {ctaLabel}
                    </Text>
                    {mode === 'cart' ? (
                        <>
                            <View style={styles.ctaDot} />
                            <RollingNumber value={price * quantity} prefix="₹" variant="button" color="onBrand" />
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onBrand} />
                        </>
                    ) : null}
                </Animated.View>
            </PressableScale>
            </Animated.View>
        </Animated.View>
    );
});

const useStyles = makeStyles((t) => ({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.lg,
        paddingBottom: space.sm,
        zIndex: z.header,
    },
    headerBg: {
        backgroundColor: t.colors.surfaceRaised,
        ...t.shadows.sm,
    },
    hairline: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: t.colors.hairline,
    },
    titleWrap: { flex: 1, marginHorizontal: space.md },
    right: { flexDirection: 'row', gap: space.sm },
    bar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.colors.surfaceRaised,
        borderTopWidth: StyleSheet.hairlineWidth * 2,
        borderTopColor: t.colors.hairline,
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        gap: space.md,
        zIndex: z.sticky,
        ...t.shadows.floating,
    },
    left: { width: LEFT_SLOT, justifyContent: 'center', minHeight: CTA_HEIGHT },
    stepper: {
        width: LEFT_SLOT,
        height: CTA_HEIGHT,
        borderRadius: radii.button,
        backgroundColor: t.colors.brandTint,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stepBtn: { width: 44, height: CTA_HEIGHT, alignItems: 'center', justifyContent: 'center' },
    ctaWrap: { flex: 1 },
    cta: {
        height: CTA_HEIGHT,
        borderRadius: radii.button,
        backgroundColor: t.colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaOn: {},
    ctaOff: { backgroundColor: t.colors.surfaceSunken },
    ctaInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    ctaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: t.colors.onBrand, opacity: 0.6 },
}));
