import React, { memo, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import ProductCard, { PRODUCT_CARD_SIZES } from '../../components/ProductCard';
import { AnimatedListItem, ContentSwap, SectionHeader, SkeletonGroup, SkeletonProductTile } from '../../components/ui';
import { space } from '../../constants/theme';

const MAX = 10;
const CARD_W = PRODUCT_CARD_SIZES.compact.width;

const productId = (p) => String(p?._id || p?.id || '');

/**
 * "You might also like": in-stock products that aren't in the cart yet (`products` from
 * useCheckoutProducts, null while loading; `excludeIds` = the cart when checkout opened plus what
 * the free-delivery rail already shows). Skeleton tiles crossfade into the rail (ContentSwap) and
 * the first cards stagger in from the left. Products added here stay (their ADD morphs into a stepper).
 */
function SuggestionsRailBase({ products, excludeIds, onOpenProduct, isHi }) {
    const data = useMemo(() => (products || [])
        .filter((p) => !excludeIds.has(productId(p)))
        .slice(0, MAX), [products, excludeIds]);

    if (products && data.length === 0) return null;

    return (
        <View>
            <SectionHeader title={isHi ? 'आपको यह भी पसंद आ सकता है' : 'You might also like'} style={styles.header} />
            <ContentSwap stateKey={products === null ? 'loading' : 'data'}>
            {products === null ? (
                <SkeletonGroup style={styles.skeletons}>
                    <SkeletonProductTile width={CARD_W} />
                    <SkeletonProductTile width={CARD_W} />
                    <SkeletonProductTile width={CARD_W} />
                </SkeletonGroup>
            ) : (
                <FlatList
                    horizontal
                    data={data}
                    keyExtractor={productId}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.list}
                    renderItem={({ item, index }) => (
                        <AnimatedListItem index={index}>
                            <ProductCard product={item} variant="compact" onPress={() => onOpenProduct(item)} />
                        </AnimatedListItem>
                    )}
                />
            )}
            </ContentSwap>
        </View>
    );
}

export const SuggestionsRail = memo(SuggestionsRailBase);

const styles = StyleSheet.create({
    header: { paddingHorizontal: space.lg },
    list: { paddingHorizontal: space.lg, gap: space.md },
    skeletons: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg },
});

export default SuggestionsRail;
