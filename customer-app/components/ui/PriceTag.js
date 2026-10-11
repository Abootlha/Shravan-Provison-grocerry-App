/**
 * PriceTag — selling price, struck MRP and an optional green "save" badge, all tabular numerals.
 *
 * Props
 *   price       number (required) — selling price in rupees
 *   mrp         number — struck through when greater than price
 *   size        'sm' (grid cards: price 16/800 + MRP 12/500, Part C #4) | 'md' (lists: 20) | 'lg' (PDP / checkout: 28)  default 'sm'
 *   showSave    boolean | 'percent' | 'amount' — savings-green badge "20% off" / "Save ₹12" (default false)
 *   layout      'row' (default: price, MRP, badge on one baseline) | 'stack' (MRP under the price)
 *   color       Text colour token (default 'strong' = colors.inkStrong: ink #151515 in light, #F2F2F2 in dark;
 *               'onNight' on ink surfaces). The save badge is the savings green ("20% off", sentence case).
 *   rolling     boolean — roll the price digits when it changes (RollingNumber)
 *   labels      { save, off } — i18n words for the badge (default { save: 'Save', off: 'off' }), e.g. { save: 'बचत', off: 'छूट' }
 *   style
 *
 * Example
 *   <PriceTag price={48} mrp={60} />
 *   <PriceTag price={248} mrp={300} size="lg" showSave="amount" rolling />
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { fontFamily, space } from '../../constants/theme';
import { Text } from './Text';
import { RollingNumber } from './RollingNumber';
import { Badge } from './Badge';

const SIZES = {
    sm: { price: 'price', strike: 'priceStrike', badge: 'sm' },
    md: { price: 'priceLarge', strike: 'priceStrike', badge: 'sm' },
    lg: { price: 'priceHero', strike: 'body', badge: 'md' },
};

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export function PriceTag({ price, mrp, size = 'sm', showSave = false, layout = 'row', color = 'strong', rolling = false, labels, style }) {
    const sz = SIZES[size] || SIZES.sm;
    const hasMrp = mrp != null && Number(mrp) > Number(price);
    const off = hasMrp ? Math.round((1 - price / mrp) * 100) : 0;
    const words = { save: 'Save', off: 'off', ...labels };
    const saveLabel = !hasMrp || !showSave ? null : showSave === 'amount' ? `${words.save} ₹${inr(mrp - price)}` : `${off}% ${words.off}`;
    const strikeColor = color === 'onNight' ? 'onNightSecondary' : 'muted';

    return (
        <View
            style={[layout === 'row' ? styles.row : styles.stack, layout === 'row' && !saveLabel && styles.baseline, style]}
            accessible
            accessibilityLabel={`₹${inr(price)}${hasMrp ? `, MRP ₹${inr(mrp)}, ${off}% off` : ''}`}
        >
            {rolling ? (
                <RollingNumber value={Number(price)} prefix="₹" variant={sz.price} color={color} style={size === 'sm' ? styles.priceSm : null} />
            ) : (
                <Text variant={sz.price} color={color} style={size === 'sm' ? styles.priceSm : null}>
                    ₹{inr(price)}
                </Text>
            )}
            {hasMrp ? (
                <Text
                    variant={sz.strike}
                    color={strikeColor}
                    tabular
                    style={size === 'lg' ? styles.strikeLg : null}
                >
                    ₹{inr(mrp)}
                </Text>
            ) : null}
            {saveLabel ? <Badge tone="discount" size={sz.badge} label={saveLabel} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.sm - 2, rowGap: space.xxs },
    baseline: { alignItems: 'baseline' }, // price + MRP share a baseline (a badge row stays centred)
    stack: { alignItems: 'flex-start', gap: space.xxs },
    priceSm: { fontFamily: fontFamily.extrabold, fontSize: 16, lineHeight: 20 }, // Part C #4: 16/800
    strikeLg: { textDecorationLine: 'line-through' },
});

export default PriceTag;
