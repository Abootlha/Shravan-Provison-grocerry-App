/**
 * FloatingCartBar — the floating cart bar (Part C §5, DESIGN.md surfaces).
 *
 *   56px bar, r14, ink surface (dark: raised + hairline, see nightPill), floating above the dock:
 *   stacked thumbnails of the last 3 items, "3 items · ₹349" with a free-delivery hint under it,
 *   "View cart ›" on the right. A thin savings-green progress line runs along the top edge toward
 *   free delivery (₹200); crossing it fires a ConfettiBurst + success haptic once.
 *
 * Motion
 *   Springs up when the cart becomes non-empty, fades/drops when it empties. On tab screens it
 *   tracks the floating dock: when the dock hides on scroll (SET_TAB_BAR_VISIBLE(false)) the
 *   pill springs down to the safe-area bottom, and back up above the dock on (true).
 *
 *   Fly-to-cart target (priority 3): the thumbnail stack bumps when a flying pack shot lands, and
 *   the thumbnails / count / ₹ total switch to the new values on impact (useFlightDeferred), so
 *   the count and price roll as the item arrives rather than on tap.
 *
 * Props
 *   onPress        () => void — open the cart / checkout (required for navigation)
 *   bottomOffset   number — distance from the screen bottom while the dock is visible. Tab screens
 *                  pass useCartBarOffset(); stack screens pass their safe-area bottom (or omit it:
 *                  auto = above the dock inside tabs, otherwise safe-area inset + 16)
 *   showDeliveryMeter  boolean (default true) — the green progress line + hint
 */
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, View } from 'react-native';
import Animated, {
    LinearTransition,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { PressableScale, Text, RollingNumber, ProgressBar, ConfettiBurst, haptic, useCartTarget, useFlightDeferred } from './ui';
import { radii, space, z } from '../constants/theme';
import { useTheme, makeStyles } from '../theme';
import { springs, durations, easings, press } from '../theme/motion';
import { useTranslation } from '../hooks/useTranslation';
import { useCartBarOffset } from './BottomTabsIcons';
import CartThumbStack from './product/CartThumbStack';
import { nightPill } from './product/nightPill';
import { FREE_DELIVERY_THRESHOLD, formatINR } from './product/productUtils';

const PILL_HEIGHT = 56;
const PILL_RADIUS = 14; // DESIGN.md: floating bars are rounded rects, not pills
const OFFSCREEN = 160;

const textLayout = LinearTransition.springify().damping(springs.snappy.damping).stiffness(springs.snappy.stiffness).mass(springs.snappy.mass);

const FloatingCartBar = ({ onPress, bottomOffset, showDeliveryMeter = true }) => {
    const styles = useStyles();
    const { colors, gradients } = useTheme();
    const { isHi } = useTranslation();
    const insets = useSafeAreaInsets();
    const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
    const dockOffset = useCartBarOffset();
    const reduce = useReducedMotion();
    const focused = useIsFocused();

    const totalItems = useSelector((s) => s.cart.totalItems);
    const totalAmount = useSelector((s) => s.cart.totalAmount);
    const items = useSelector((s) => s.cart.items);

    const hasItems = totalItems > 0;
    const [mounted, setMounted] = useState(hasItems);
    // What the pill shows changes when a flying item lands, not on tap.
    const live = useMemo(() => ({ totalItems, totalAmount, items }), [totalItems, totalAmount, items]);
    const landed = useFlightDeferred(live);
    // Keep the last non-empty snapshot so the pill doesn't blank out while it exits.
    const snapshot = useRef(live);
    if (hasItems) snapshot.current = landed.totalItems > 0 ? landed : live;

    const stackRef = useRef(null);
    const bump = useCartTarget(stackRef, { priority: 3, enabled: hasItems && mounted });

    const shown = useSharedValue(hasItems ? 1 : 0);
    const drop = useSharedValue(0);

    useEffect(() => {
        if (hasItems) {
            setMounted(true);
            shown.value = reduce ? withTiming(1, { duration: durations.base }) : withSpring(1, springs.sheet);
        } else {
            shown.value = withTiming(0, { duration: durations.base, easing: easings.out }, (done) => {
                if (done) scheduleOnRN(setMounted, false);
            });
        }
    }, [hasItems, reduce]);

    const restBottom = insets.bottom + space.md;
    const bottom = bottomOffset != null ? bottomOffset : inTabs ? dockOffset : insets.bottom + space.lg;
    const followsDock = inTabs || bottomOffset != null;
    const dockDrop = Math.max(0, bottom - restBottom);

    // Follow the floating dock: it hides on scroll-down and springs back on scroll-up.
    useEffect(() => {
        if (!followsDock || !focused) return undefined;
        drop.value = withSpring(0, springs.sheet); // the dock is always shown after a tab switch
        const sub = DeviceEventEmitter.addListener('SET_TAB_BAR_VISIBLE', (visible) => {
            const to = visible === false ? dockDrop : 0;
            drop.value = reduce ? to : withSpring(to, springs.sheet);
        });
        return () => sub.remove();
    }, [followsDock, focused, dockDrop, reduce]);

    // Free-delivery celebration: once per crossing of the threshold.
    const snap = snapshot.current;
    const unlocked = snap.totalAmount >= FREE_DELIVERY_THRESHOLD;
    const confetti = useRef(null);
    const wasUnlocked = useRef(unlocked);
    useEffect(() => {
        if (unlocked && !wasUnlocked.current && hasItems) {
            confetti.current?.fire();
            haptic.success();
        }
        wasUnlocked.current = unlocked;
    }, [unlocked, hasItems]);

    const anim = useAnimatedStyle(() => ({
        opacity: shown.value,
        transform: [{ translateY: (reduce ? 0 : (1 - shown.value) * OFFSCREEN) + drop.value }],
    }));

    if (!mounted) return null;

    const count = snap.totalItems;
    const itemsWord = isHi ? 'सामान' : count === 1 ? 'item' : 'items';
    const remaining = Math.max(0, Math.ceil(FREE_DELIVERY_THRESHOLD - snap.totalAmount));
    const hint = unlocked
        ? isHi
            ? 'मुफ़्त डिलीवरी मिल गई'
            : 'Free delivery unlocked'
        : isHi
          ? `₹${formatINR(remaining)} और, मुफ़्त डिलीवरी के लिए`
          : `₹${formatINR(remaining)} more for free delivery`;
    const viewCart = isHi ? 'कार्ट देखें' : 'View cart';

    return (
        <Animated.View style={[styles.wrap, { bottom }, anim, { pointerEvents: hasItems ? 'box-none' : 'none' }]}>
            <PressableScale
                onPress={onPress}
                haptic="light"
                scaleTo={press.subtle}
                style={styles.pill}
                accessibilityLabel={`${viewCart}, ${count} ${itemsWord}, ₹${formatINR(snap.totalAmount)}${showDeliveryMeter ? `. ${hint}` : ''}`}
            >
                {showDeliveryMeter ? (
                    <View style={[styles.meter, { pointerEvents: 'none' }]}>
                        <ProgressBar
                            value={snap.totalAmount / FREE_DELIVERY_THRESHOLD}
                            height={3}
                            gradient={gradients.freeDelivery}
                            trackColor={colors.haloOnBrand}
                            accessibilityLabel="Free delivery progress"
                        />
                    </View>
                ) : null}
                <Animated.View ref={stackRef} collapsable={false} style={bump}>
                    <CartThumbStack items={snap.items} />
                </Animated.View>
                <Animated.View layout={textLayout} style={styles.info}>
                    <View style={styles.metaRow}>
                        <RollingNumber value={count} variant="title" color="onNight" suffix={` ${itemsWord}`} />
                        <View style={styles.dot} />
                        <RollingNumber value={snap.totalAmount} currency variant="title" color="onNight" />
                    </View>
                    {showDeliveryMeter ? (
                        <View style={styles.hintRow}>
                            {unlocked ? <MaterialCommunityIcons name="check-circle" size={12} color={colors.success} /> : null}
                            <Text variant="caption" color="onNightSecondary" numberOfLines={1} style={styles.hint}>
                                {hint}
                            </Text>
                        </View>
                    ) : null}
                </Animated.View>
                <View style={styles.cta}>
                    <Text variant="label" color="onNight" numberOfLines={1}>
                        {viewCart}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.onNight} />
                </View>
            </PressableScale>
            <ConfettiBurst ref={confetti} spread={120} />
        </Animated.View>
    );
};

const useStyles = makeStyles((t) => ({
    wrap: {
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        zIndex: z.sticky,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: PILL_RADIUS,
        height: PILL_HEIGHT,
        paddingLeft: space.md - 2,
        paddingRight: space.sm,
        ...t.shadows.floating,
        ...nightPill(t),
    },
    meter: {
        position: 'absolute',
        top: 0,
        left: PILL_RADIUS,
        right: PILL_RADIUS,
    },
    info: {
        flex: 1,
        justifyContent: 'center',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        marginHorizontal: space.xs + 2,
        backgroundColor: t.colors.onNightMuted,
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
    hint: {
        flexShrink: 1,
    },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        paddingLeft: space.md,
        paddingRight: space.xs,
        borderRadius: radii.button,
        backgroundColor: t.colors.brand,
        gap: space.xxs,
    },
}));

export default FloatingCartBar;
