/**
 * ProductRail — horizontal rail of compact ProductCards with skeletons while loading.
 * Props: title, subtitle, products (raw API or card-shaped), loading, onProductPress(product)
 */
import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SectionHeader, SkeletonGroup } from '../ui';
import { space } from '../../constants/theme';
import ProductCard, { PRODUCT_CARD_SIZES } from '../ProductCard';
import ProductCardSkeleton from '../ProductCardSkeleton';
import { getProductId } from './productUtils';

const RAIL_HEIGHT = PRODUCT_CARD_SIZES.compact.height + space.lg;

function ProductRail({ title, subtitle, products = [], loading = false, onProductPress }) {
    const renderItem = useCallback(
        ({ item }) => <ProductCard product={item} variant="compact" onPress={() => onProductPress?.(item)} />,
        [onProductPress]
    );

    if (!loading && products.length === 0) return null;

    return (
        <View style={styles.wrap}>
            <SectionHeader title={title} subtitle={subtitle} style={styles.header} />
            {loading ? (
                <SkeletonGroup style={styles.skeletonRow}>
                    {[0, 1, 2].map((i) => (
                        <ProductCardSkeleton key={i} variant="compact" />
                    ))}
                </SkeletonGroup>
            ) : (
                <View style={{ height: RAIL_HEIGHT }}>
                    <FlashList
                        data={products}
                        horizontal
                        renderItem={renderItem}
                        keyExtractor={(item) => String(getProductId(item))}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.list}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { paddingTop: space.xl },
    header: { paddingHorizontal: space.lg },
    skeletonRow: { flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.md },
    list: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
});

export default memo(ProductRail);
