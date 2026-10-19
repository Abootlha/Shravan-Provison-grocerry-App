/**
 * VariantSheet — the pack-size chooser a card's ADD opens when a product has more than one size.
 *
 * Each row: pack size, price + struck MRP, unit price, and its own ADD/stepper. Every active,
 * in-stock pack can go in the cart; each pack is its own cart line (variantLineOf) and the
 * order / quote send its `variantSku`, so the server prices and reserves that pack. The stepper
 * stops at that pack's stock.
 *
 * Props: visible, onClose, product (card shape: id, name, image, unit, variants), cartName
 *        (source-language name for the cart), isHi, onAdded(line) — optional, after a first add
 */
import React, { memo, useCallback } from 'react';
import { View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AddToCartButton, BottomSheet, PriceTag, Text } from '../ui';
import { space } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { addToCart, decrementQuantity, incrementQuantity } from '../../store/slices/cartSlice';
import { activeVariants, unitPriceLabel, variantLineOf } from './productUtils';

const VariantRow = memo(function VariantRow({ product, variant, cartName, isHi, divider, onAdded }) {
    const styles = useStyles();
    const dispatch = useDispatch();
    const line = variantLineOf(product, variant, cartName);
    const quantity = useSelector((s) => s.cart.items.find((it) => it.id === line.id)?.quantity || 0);
    const stock = Math.max(0, Number(variant.stock) || 0);
    const per = unitPriceLabel(variant.sellingPrice, variant.unit, isHi);
    const onAdd = useCallback(() => {
        dispatch(addToCart(line));
        onAdded?.(line);
    }, [dispatch, line, onAdded]);
    const onInc = useCallback(() => dispatch(incrementQuantity(line.id)), [dispatch, line.id]);
    const onDec = useCallback(() => dispatch(decrementQuantity(line.id)), [dispatch, line.id]);
    const atLimit = stock > 0 && quantity >= stock;
    return (
        <View style={[styles.row, divider && styles.divider]}>
            <View style={styles.info}>
                <Text variant="bodyStrong">{variant.unit}</Text>
                <PriceTag price={variant.sellingPrice} mrp={variant.mrp > variant.sellingPrice ? variant.mrp : null} size="sm" />
                {atLimit ? (
                    <Text variant="caption" weight="semibold" color="error">
                        {isHi ? `सिर्फ़ ${stock} बचे` : `Only ${stock} left`}
                    </Text>
                ) : per ? (
                    <Text variant="caption" color="muted">
                        {per}
                    </Text>
                ) : null}
            </View>
            <AddToCartButton
                size="md"
                quantity={quantity}
                productName={`${product.name} ${variant.unit}`}
                outOfStock={stock <= 0}
                max={stock || undefined}
                label={isHi ? 'जोड़ें' : 'ADD'}
                outOfStockLabel={isHi ? 'स्टॉक ख़त्म' : 'Sold out'}
                onAdd={onAdd}
                onIncrement={onInc}
                onDecrement={onDec}
            />
        </View>
    );
});

function VariantSheet({ visible, onClose, product, cartName, isHi, onAdded }) {
    const styles = useStyles();
    const variants = activeVariants(product);
    return (
        <BottomSheet visible={visible} onClose={onClose} title={product.name} subtitle={isHi ? `${variants.length} पैक साइज़` : `${variants.length} pack sizes`}>
            <View style={styles.list}>
                {variants.map((v, i) => (
                    <VariantRow key={v.sku || v.unit} product={product} variant={v} cartName={cartName} isHi={isHi} divider={i > 0} onAdded={onAdded} />
                ))}
            </View>
        </BottomSheet>
    );
}

const useStyles = makeStyles((t) => ({
    list: { paddingBottom: space.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
    divider: { borderTopWidth: 1, borderTopColor: t.colors.hairline },
    info: { flex: 1, gap: space.xxs },
}));

export default memo(VariantSheet);
