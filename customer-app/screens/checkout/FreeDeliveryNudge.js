import React, { memo, useCallback, useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProductImage from '../../components/product/ProductImage';
import { AddToCartButton, ConfettiBurst, ProgressBar, Text, haptic } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { addToCart, decrementQuantity, incrementQuantity } from '../../store/slices/cartSlice';
import { productId } from './useCheckoutProducts';

const BAR = 6;
const TILE_W = 216;
const THUMB = 44;

/** One compact product in the "close the gap" rail: thumb, name, price, inline ADD/stepper. */
const FillerTile = memo(function FillerTile({ product, isHi }) {
    const styles = useStyles();
    const dispatch = useDispatch();
    const id = productId(product);
    const quantity = useSelector((s) => s.cart.items.find((it) => it.id === id)?.quantity || 0);
    const onAdd = useCallback(() => dispatch(addToCart(product)), [dispatch, product]);
    const onInc = useCallback(() => dispatch(incrementQuantity(id)), [dispatch, id]);
    const onDec = useCallback(() => dispatch(decrementQuantity(id)), [dispatch, id]);
    const mrp = Number(product.originalPrice) || 0;
    return (
        <View style={styles.tile}>
            <ProductImage uri={product.image} variant="thumb" size={THUMB} recyclingKey={id} />
            <View style={styles.tileText}>
                <Text variant="caption" color="ink" numberOfLines={2}>{product.name}</Text>
                <View style={styles.priceRow}>
                    <Text variant="label">₹{product.price}</Text>
                    {mrp > product.price ? <Text variant="priceStrike" color="muted">₹{mrp}</Text> : null}
                </View>
            </View>
            <AddToCartButton
                size="sm"
                quantity={quantity}
                productName={product.name}
                label={isHi ? 'जोड़ें' : 'ADD'}
                onAdd={onAdd}
                onIncrement={onInc}
                onDecrement={onDec}
            />
        </View>
    );
});

/**
 * Free-delivery meter: a flat savings-green ProgressBar on the hairline track. Below the
 * threshold, a compact rail of real catalogue products priced to close the gap (`fillers`),
 * each with an inline ADD. The copy swaps on the crossing and — only on the crossing, never on
 * mount — one confetti pop + success haptic. Reduced motion: no confetti.
 * `threshold` is the server's fees.freeDeliveryThreshold.
 */
function FreeDeliveryNudgeBase({ itemTotal, gap, threshold, fillers = [], isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const unlocked = gap <= 0;
    const wasUnlocked = useRef(unlocked);
    const confetti = useRef(null);

    useEffect(() => {
        const crossed = unlocked && !wasUnlocked.current;
        wasUnlocked.current = unlocked;
        if (!crossed) return;
        haptic.success();
        if (!reduce) confetti.current?.fire();
    }, [unlocked, reduce]);

    return (
        <View style={styles.wrap} accessibilityLiveRegion="polite">
            <View style={styles.row}>
                {unlocked ? (
                    <Animated.View key="t-on" entering={layout.enter} style={styles.text}>
                        <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.success} />
                        <Text variant="label" color="success">
                            {isHi ? 'मुफ़्त डिलीवरी मिल गई' : 'Free delivery unlocked'}
                        </Text>
                    </Animated.View>
                ) : (
                    <View style={styles.text}>
                        <Text variant="label" color="secondary" weight="medium">
                            {isHi ? (
                                <>मुफ़्त डिलीवरी के लिए <Text variant="label" color="ink">₹{gap}</Text> और जोड़ें</>
                            ) : (
                                <>Add <Text variant="label" color="ink">₹{gap}</Text> more for free delivery</>
                            )}
                        </Text>
                    </View>
                )}
                <ConfettiBurst ref={confetti} count={14} spread={110} />
            </View>
            <ProgressBar
                value={threshold > 0 ? itemTotal / threshold : 1}
                height={BAR}
                color={colors.success}
                trackColor={colors.hairline}
                accessibilityLabel={isHi ? 'मुफ़्त डिलीवरी प्रगति' : 'Free delivery progress'}
            />
            {!unlocked && fillers.length ? (
                <Animated.View entering={layout.enter} exiting={layout.exit}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.rail}
                        style={styles.railScroll}
                        accessibilityLabel={isHi ? 'मुफ़्त डिलीवरी के लिए सुझाव' : 'Suggestions to reach free delivery'}
                    >
                        {fillers.map((p) => <FillerTile key={productId(p)} product={p} isHi={isHi} />)}
                    </ScrollView>
                </Animated.View>
            ) : null}
        </View>
    );
}

export const FreeDeliveryNudge = memo(FreeDeliveryNudgeBase);

const useStyles = makeStyles((t) => ({
    wrap: { gap: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    text: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
    // bleed to the card edges so the rail scrolls edge to edge
    railScroll: { marginHorizontal: -space.lg, marginTop: space.xs },
    rail: { paddingHorizontal: space.lg, gap: space.sm },
    tile: {
        width: TILE_W,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.sm,
        borderRadius: radii.well,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        backgroundColor: t.colors.surface,
    },
    tileText: { flex: 1, gap: 2 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
}));

export default FreeDeliveryNudge;
