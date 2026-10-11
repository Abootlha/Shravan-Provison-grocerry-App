/**
 * ProductCardSkeleton — bones that mirror ProductCard's geometry exactly (same outer size,
 * square well, ADD overhang, price row, two name lines, meta row), so content swaps in
 * without a jump.
 *
 * Props: variant ('default'|'regular'|'compact'|'large'), style (e.g. { width: '100%' }).
 * Wrap several in one <SkeletonGroup> to share a shimmer clock; a lone skeleton makes its own.
 */
import React, { memo } from 'react';
import { View } from 'react-native';
import { Skeleton, SkeletonGroup } from './ui';
import { space } from '../constants/theme';
import { useTheme, makeStyles } from '../theme';
import { PRODUCT_CARD_SIZES, CARD_PAD, CARD_RADIUS, WELL_RADIUS } from './ProductCard';

function ProductCardSkeleton({ variant = 'default', style }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const size = PRODUCT_CARD_SIZES[variant] || PRODUCT_CARD_SIZES.regular;
    return (
        <SkeletonGroup style={[styles.card, { width: size.width }, style]} accessibilityLabel="Loading product">
            <View style={styles.well}>
                <Skeleton width="100%" height="100%" radius={WELL_RADIUS} tint={colors.imageWell} />
            </View>
            <View style={styles.body}>
                <View style={styles.row}>
                    <Skeleton width={40} height={14} />
                    <Skeleton width={28} height={10} />
                </View>
                <View style={styles.lines}>
                    <Skeleton width="92%" height={11} />
                    <Skeleton width="60%" height={11} />
                </View>
                <View style={styles.meta}>
                    <Skeleton width="48%" height={10} />
                </View>
            </View>
        </SkeletonGroup>
    );
}

const useStyles = makeStyles((t) => ({
    card: {
        backgroundColor: t.colors.surface,
        borderRadius: CARD_RADIUS,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        padding: CARD_PAD - 1,
        marginRight: space.sm + 2,
        marginBottom: space.sm + 2,
    },
    well: { width: '100%', aspectRatio: 1 },
    body: {
        paddingHorizontal: space.xs,
        paddingTop: space.lg,
        paddingBottom: space.xs,
    },
    row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs + 2, height: 20, paddingBottom: 3 },
    lines: { gap: 7, marginTop: space.xxs, height: 36, justifyContent: 'center' },
    meta: { height: 16, marginTop: space.xs, justifyContent: 'center' },
}));

export default memo(ProductCardSkeleton);
