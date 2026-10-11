/**
 * Search results: matching categories (rail) then a 2-column ProductCard grid in FlashList.
 * Results fade + rise in with a short stagger each time a new query lands; skeletons while
 * the first page loads; an EmptyState (mascot allowed on empty states) naming the query and one
 * action when nothing matches.
 */
import React, { memo, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import { AnimatedListItem, EmptyState, SectionHeader, SkeletonGroup, Text } from '../../components/ui';
import { space } from '../../constants/theme';
import ProductCard from '../../components/ProductCard';
import ProductCardSkeleton from '../../components/ProductCardSkeleton';
import { getProductId } from '../../components/product/productUtils';
import { CategoryTile } from './SearchIdle';

const GRID_CARD = { width: '100%', marginRight: 0 };
const FULL = { width: '100%' };

const Cell = memo(({ item, index, onPress }) => (
    <AnimatedListItem index={index} style={styles.cell}>
        <ProductCard product={item} style={GRID_CARD} onPress={() => onPress(item)} />
    </AnimatedListItem>
));

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

function SearchResults({ query, results, total, loading, matchedCategories, onProductPress, onCategory, onClear, isHi, bottomPad, onScroll }) {
    const renderItem = useCallback(
        ({ item, index }) => <Cell item={item} index={index} onPress={onProductPress} />,
        [onProductPress]
    );

    if (loading && results.length === 0) {
        return (
            <View style={styles.pad}>
                <SkeletonGroup style={styles.skeletonGrid}>
                    {[0, 1, 2, 3].map((i) => (
                        <View key={i} style={styles.skeletonCell}>
                            <ProductCardSkeleton style={GRID_CARD} />
                        </View>
                    ))}
                </SkeletonGroup>
            </View>
        );
    }

    if (!loading && results.length === 0 && matchedCategories.length === 0) {
        return (
            <EmptyState
                mood="sad"
                title={isHi ? `'${query}' के लिए कुछ नहीं मिला` : `No results for '${query}'`}
                subtitle={isHi ? 'वर्तनी जाँचें या कोई आसान शब्द आज़माएँ, जैसे "दूध"।' : 'Check the spelling or try a simpler word, like "milk".'}
                actionLabel={isHi ? 'खोज साफ़ करें' : 'Clear search'}
                onAction={onClear}
            />
        );
    }

    const header = (
        <View>
            {matchedCategories.length > 0 ? (
                <AnimatedListItem index={0} style={styles.catSection}>
                    <SectionHeader title={isHi ? 'श्रेणियाँ' : 'Categories'} style={styles.hPad} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow} keyboardShouldPersistTaps="handled">
                        {matchedCategories.map((c) => (
                            <View key={c._id || c.id} style={styles.catTile}>
                                <CategoryTile category={c} isHi={isHi} style={FULL} onPress={() => onCategory(c)} />
                            </View>
                        ))}
                    </ScrollView>
                </AnimatedListItem>
            ) : null}
            {results.length > 0 ? (
                <View style={[styles.hPad, styles.countRow]}>
                    <Text variant="h3" numberOfLines={1} style={styles.countTitle} accessibilityRole="header">
                        {isHi ? `“${query}” के नतीजे` : `Results for “${query}”`}
                    </Text>
                    <Text variant="caption" color="muted">
                        {isHi ? `${total} परिणाम` : `${total} ${total === 1 ? 'result' : 'results'}`}
                    </Text>
                </View>
            ) : null}
        </View>
    );

    return (
        <AnimatedFlashList
            key={query}
            onScroll={onScroll}
            scrollEventThrottle={16}
            data={results}
            numColumns={2}
            renderItem={renderItem}
            keyExtractor={(item) => String(getProductId(item))}
            ListHeaderComponent={header}
            contentContainerStyle={{ paddingHorizontal: space.md - space.xs, paddingBottom: bottomPad }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    pad: { paddingHorizontal: space.md - space.xs, paddingTop: space.lg },
    skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { flex: 1, paddingHorizontal: space.xs },
    skeletonCell: { width: '50%', paddingHorizontal: space.xs },
    hPad: { paddingHorizontal: space.xs },
    catSection: { paddingTop: space.lg, gap: space.md },
    catRow: { paddingHorizontal: space.xs, gap: space.sm },
    catTile: { width: 84 },
    countRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingTop: space.xl,
        paddingBottom: space.md,
        gap: space.md,
    },
    countTitle: { flexShrink: 1 },
});

export default memo(SearchResults);
