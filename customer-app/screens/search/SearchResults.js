/**
 * Search results: suggestions (while typing), matching categories (rail), a "Showing results for"
 * line when the query was corrected or translated, then a 2-column ProductCard grid in FlashList.
 * Results fade + rise in with a short stagger each time a new query lands; skeletons while the
 * first page loads.
 *
 * No results is never a dead end: the query is named, then "Request this item" (WhatsApp to the
 * store's own number from the settings, only when the store has set one), category shortcuts and
 * the best sellers that are in stock.
 */
import React, { memo, useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AnimatedListItem, Button, EmptyState, PressableScale, SectionHeader, SkeletonGroup, Text } from '../../components/ui';
import { friendlyError } from '../../services/normalize';
import { space } from '../../constants/theme';
import { useTheme } from '../../theme';
import ProductCard from '../../components/ProductCard';
import ProductCardSkeleton from '../../components/ProductCardSkeleton';
import { getProductId } from '../../components/product/productUtils';
import { CategoryTile } from './SearchIdle';

const GRID_CARD = { width: '100%', marginRight: 0 };
const FULL = { width: '100%' };

const Cell = memo(({ item, index, onPress }) => (
    <AnimatedListItem index={index} style={styles.cell}>
        <ProductCard product={item} variant="grid" style={GRID_CARD} onPress={() => onPress(item)} />
    </AnimatedListItem>
));

const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

/** "Showing results for 'milk'" + "Search instead for 'doodh'". */
const Corrected = memo(function Corrected({ corrected, original, onExact, isHi }) {
    const { colors } = useTheme();
    return (
        <View style={styles.corrected} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="spellcheck" size={18} color={colors.inkMuted} />
            <View style={styles.flex}>
                <Text variant="body" color="secondary">
                    {isHi ? 'नतीजे दिखा रहे हैं: ' : 'Showing results for '}
                    <Text variant="bodyStrong" color="ink">
                        ‘{corrected}’
                    </Text>
                </Text>
                <PressableScale onPress={onExact} hitSlop={{ top: 8, bottom: 8 }} accessibilityRole="link" style={styles.exact}>
                    <Text variant="label" color="brand">
                        {isHi ? `इसके बजाय ‘${original}’ खोजें` : `Search instead for ‘${original}’`}
                    </Text>
                </PressableScale>
            </View>
        </View>
    );
});

/** Category shortcuts + popular in-stock items under a no-results message. */
function Recovery({ query, isHi, categories, popular, onCategory, onProductPress, requestLabel, onRequest, onClear, bottomPad, suggestions }) {
    return (
        <ScrollView contentContainerStyle={[styles.recovery, { paddingBottom: bottomPad }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {suggestions}
            <EmptyState
                compact
                mood="sad"
                title={isHi ? `‘${query}’ के लिए कुछ नहीं मिला` : `No results for ‘${query}’`}
                subtitle={
                    onRequest
                        ? isHi
                            ? 'दुकान से पूछें, हो सकता है वे इसे मँगवा दें। या नीचे से चुनें।'
                            : 'Ask the store to stock it, or pick from the aisles below.'
                        : isHi
                          ? 'वर्तनी जाँचें या नीचे की श्रेणियों में देखें।'
                          : 'Check the spelling or look through the aisles below.'
                }
                actionLabel={onRequest ? requestLabel : isHi ? 'खोज साफ़ करें' : 'Clear search'}
                onAction={onRequest || onClear}
                secondaryLabel={onRequest ? (isHi ? 'खोज साफ़ करें' : 'Clear search') : undefined}
                onSecondary={onRequest ? onClear : undefined}
            />
            {categories.length ? (
                <View style={styles.block}>
                    <SectionHeader title={isHi ? 'श्रेणियों में देखें' : 'Browse the aisles'} />
                    <View style={styles.catGrid}>
                        {categories.slice(0, 8).map((c) => (
                            <CategoryTile key={c._id || c.id} category={c} isHi={isHi} onPress={() => onCategory(c)} />
                        ))}
                    </View>
                </View>
            ) : null}
            {popular.length ? (
                <View style={styles.block}>
                    <SectionHeader title={isHi ? 'अभी सबसे ज़्यादा बिकने वाले' : 'Popular right now'} />
                    <View style={styles.popGrid}>
                        {popular.slice(0, 6).map((p) => (
                            <View key={String(getProductId(p))} style={styles.popCell}>
                                <ProductCard product={p} variant="grid" style={GRID_CARD} onPress={() => onProductPress(p)} />
                            </View>
                        ))}
                    </View>
                </View>
            ) : null}
        </ScrollView>
    );
}

function SearchResults({
    query,
    results,
    total,
    loading,
    error,
    onRetry,
    matchedCategories,
    onProductPress,
    onCategory,
    onClear,
    isHi,
    bottomPad,
    onScroll,
    corrected,
    onExact,
    suggestions,
    categories = [],
    popular = [],
    onRequest,
}) {
    const renderItem = useCallback(({ item, index }) => <Cell item={item} index={index} onPress={onProductPress} />, [onProductPress]);
    const requestLabel = isHi ? 'यह सामान माँगें' : 'Request this item';

    if (loading && results.length === 0) {
        return (
            <View style={styles.pad}>
                {suggestions}
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

    if (!loading && error && results.length === 0) {
        return (
            <EmptyState
                mood="sad"
                title={isHi ? 'खोज नहीं हो सकी' : 'Search didn’t load'}
                subtitle={friendlyError(error, isHi)}
                actionLabel={isHi ? 'फिर कोशिश करें' : 'Try again'}
                onAction={onRetry}
            />
        );
    }

    if (!loading && results.length === 0 && matchedCategories.length === 0) {
        return (
            <Recovery
                query={query}
                isHi={isHi}
                categories={categories}
                popular={popular}
                onCategory={onCategory}
                onProductPress={onProductPress}
                requestLabel={requestLabel}
                onRequest={onRequest}
                onClear={onClear}
                bottomPad={bottomPad}
                suggestions={suggestions}
            />
        );
    }

    const header = (
        <View style={styles.hPad}>
            {suggestions}
            {corrected ? <Corrected corrected={corrected} original={query} onExact={onExact} isHi={isHi} /> : null}
            {matchedCategories.length > 0 ? (
                <AnimatedListItem index={0} style={styles.catSection}>
                    <SectionHeader title={isHi ? 'श्रेणियाँ' : 'Categories'} />
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
                <View style={styles.countRow}>
                    <Text variant="h3" numberOfLines={1} style={styles.countTitle} accessibilityRole="header">
                        {isHi ? `‘${corrected || query}’ के नतीजे` : `Results for ‘${corrected || query}’`}
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
            ListFooterComponent={
                onRequest && results.length > 0 ? (
                    <View style={[styles.hPad, styles.footer]}>
                        <Text variant="caption" color="muted" align="center">
                            {isHi ? 'जो चाहिए वो नहीं मिला?' : 'Didn’t find what you need?'}
                        </Text>
                        <Button variant="ghost" size="sm" label={requestLabel} onPress={onRequest} />
                    </View>
                ) : null
            }
            contentContainerStyle={{ paddingHorizontal: space.lg - space.xs, paddingBottom: bottomPad }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
        />
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    pad: { paddingHorizontal: space.lg, paddingTop: space.sm },
    skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs, marginTop: space.lg },
    cell: { flex: 1, paddingHorizontal: space.xs },
    skeletonCell: { width: '50%', paddingHorizontal: space.xs },
    hPad: { paddingHorizontal: space.xs },
    catSection: { paddingTop: space.lg, gap: space.md },
    catRow: { gap: space.sm },
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
    corrected: { flexDirection: 'row', gap: space.sm, paddingTop: space.lg, alignItems: 'flex-start' },
    exact: { alignSelf: 'flex-start', marginTop: space.xxs },
    recovery: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space['2xl'] },
    block: { gap: space.md },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, marginHorizontal: -space.xs },
    popGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
    popCell: { width: '50%', paddingHorizontal: space.xs },
    footer: { alignItems: 'center', paddingTop: space.lg, gap: space.xs },
});

export default memo(SearchResults);
