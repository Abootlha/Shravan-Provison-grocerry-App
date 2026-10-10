import React, { memo, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ProductService } from '../../services';
import ProductCard, { PRODUCT_CARD_SIZES } from '../../components/ProductCard';
import { AnimatedListItem, ContentSwap, SectionHeader, SkeletonGroup, SkeletonProductTile } from '../../components/ui';
import { space } from '../../constants/theme';

const MAX = 10;
const CARD_W = PRODUCT_CARD_SIZES.compact.width;

const productId = (p) => String(p?._id || p?.id || '');

/**
 * "You might also like": in-stock products that aren't in the cart yet. Skeleton tiles
 * crossfade into the rail (ContentSwap) and the first cards stagger in from the left.
 */
function SuggestionsRailBase({ cartItems, onOpenProduct, isHi }) {
    const [products, setProducts] = useState(null);

    useEffect(() => {
        let alive = true;
        ProductService.getProducts({ limit: 24 })
            .then((res) => { if (alive) setProducts(res?.products || []); })
            .catch(() => { if (alive) setProducts([]); });
        return () => { alive = false; };
    }, []);

    // Products already added stay in the rail (their ADD morphs into a stepper),
    // so the list only filters against what was in the cart when it loaded.
    const [initialCartIds] = useState(() => new Set(cartItems.map((i) => String(i.productId || i.id))));
    const data = useMemo(() => (products || [])
        .filter((p) => p.isAvailable !== false && (p.stock == null || p.stock > 0))
        .filter((p) => !initialCartIds.has(productId(p)))
        .slice(0, MAX), [products, initialCartIds]);

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
