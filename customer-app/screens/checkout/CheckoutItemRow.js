/**
 * One line in the checkout's grouped "items" card (Part C §9): 56px packshot on the
 * image well, name + pack, price with struck MRP, and the compact violet stepper with
 * the line total (rolling) under it. − at quantity 1 removes the line (cart slice), and the
 * row slides out while the rows below spring up (layout.list).
 *
 * Swipe left to reveal Delete; a full swipe (haptic at the threshold) removes the line via
 * `onRemove(item, index)` — the screen owns the Undo toast. The row spans the card edge to
 * edge so the red panel meets the card's corners; content keeps the card's 16px gutter.
 */
import React, { memo, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import ProductImage from '../../components/product/ProductImage';
import { useDispatch } from 'react-redux';
import { decrementQuantity, incrementQuantity } from '../../store/slices/cartSlice';
import { AddToCartButton, Divider, RollingNumber, SwipeableRow, Text } from '../../components/ui';
import { space } from '../../constants/theme';
import { layout, makeStyles } from '../../theme';
import { durations } from '../../theme/motion';
import { useTranslation } from '../../hooks/useTranslation';
import { translateToHindi } from '../../services/translationService';
import { formatINR } from '../../components/product/productUtils';

const THUMB = 56;
/** Left inset of the hairline between rows: gutter + thumb + gap (aligns with the name). */
export const ROW_DIVIDER_INSET = space.lg + THUMB + space.md;

const useTranslatedName = (item) => {
    const { currentLanguage } = useTranslation();
    const [name, setName] = useState(item.name);
    useEffect(() => {
        let alive = true;
        if (currentLanguage !== 'hi') {
            setName(item.name);
            return undefined;
        }
        (async () => {
            try {
                const translated = item.nameHi || (await translateToHindi(item.name));
                if (alive) setName(translated);
            } catch {
                if (alive) setName(item.name);
            }
        })();
        return () => { alive = false; };
    }, [currentLanguage, item.name, item.nameHi]);
    return name;
};

function CheckoutItemRowBase({ item, index = 0, showDivider = false, onRemove, isHi }) {
    const styles = useStyles();
    const dispatch = useDispatch();
    const name = useTranslatedName(item);
    const onInc = useCallback(() => dispatch(incrementQuantity(item.id)), [dispatch, item.id]);
    const onDec = useCallback(() => dispatch(decrementQuantity(item.id)), [dispatch, item.id]);

    const price = Number(item.price) || 0;
    const mrp = Number(item.originalPrice) || 0;
    const lineTotal = price * item.quantity;
    const lineMrp = mrp > price ? mrp * item.quantity : 0;

    return (
        <Animated.View entering={FadeIn.duration(durations.base)} exiting={layout.exitLeft} layout={layout.list}>
            {showDivider ? <Divider inset={ROW_DIVIDER_INSET} style={styles.divider} /> : null}
            <SwipeableRow
                enabled={!!onRemove}
                actionLabel={isHi ? 'हटाएं' : 'Remove'}
                actionIcon="trash-can-outline"
                accessibilityActionLabel={isHi ? `${name} हटाएं` : `Remove ${name}`}
                onAction={() => onRemove && onRemove(item, index)}
            >
                <View style={styles.row}>
                    <ProductImage uri={item.image} variant="thumb" size={THUMB} recyclingKey={item.id} />

                    <View style={styles.info}>
                        <Text variant="label" numberOfLines={2}>{name}</Text>
                        <Text variant="caption" color="muted" numberOfLines={1}>
                            {item.unit ? `${item.unit} · ₹${formatINR(price)}` : `₹${formatINR(price)} each`}
                        </Text>
                    </View>

                    <View style={styles.side}>
                        <AddToCartButton
                            size="sm"
                            quantity={item.quantity}
                            productName={name}
                            onAdd={onInc}
                            onIncrement={onInc}
                            onDecrement={onDec}
                        />
                        <View style={styles.totals}>
                            {lineMrp ? <Text variant="priceStrike" color="muted">₹{formatINR(lineMrp)}</Text> : null}
                            <RollingNumber value={lineTotal} prefix="₹" format={formatINR} variant="price" />
                        </View>
                    </View>
                </View>
            </SwipeableRow>
        </Animated.View>
    );
}

export const CheckoutItemRow = memo(CheckoutItemRowBase);

const useStyles = makeStyles((t) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        backgroundColor: t.colors.surface,
    },
    divider: { marginRight: space.lg },
    info: { flex: 1, gap: space.xxs },
    side: { alignItems: 'flex-end', gap: space.xs },
    totals: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
}));

export default CheckoutItemRow;
