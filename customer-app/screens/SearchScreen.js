/**
 * SearchScreen — live product search against the real API (GET /products?search=), with
 * persisted recent searches, trending chips, popular categories, grouped results
 * (categories, then a 2-column product grid), skeletons and a mascot empty state.
 *
 * Route params: { fromRect } — optional window rect of Home's search bar; the field springs from
 * it into place (SearchHeader). Idle ↔ loading ↔ results ↔ empty crossfade through ContentSwap.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContentSwap, Screen } from '../components/ui';
import FloatingCartBar from '../components/FloatingCartBar';
import { useCartBarOffset, useTabBarScroll } from '../components/BottomTabsIcons';
import { space } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';
import { ProductService } from '../services/services';
import SearchHeader from './search/SearchHeader';
import SearchIdle from './search/SearchIdle';
import SearchResults from './search/SearchResults';
import useProductSearch from './search/useProductSearch';
import useRecentSearches from './search/useRecentSearches';

/** Space for the floating tab bar + cart bar under the list. */
const TAB_BAR_SPACE = 200;

const SearchScreen = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const cartBarOffset = useCartBarOffset();
    const { onScroll, reveal } = useTabBarScroll(navigation);
    const { currentLanguage, isHi } = useTranslation();
    const [query, setQuery] = useState('');
    const [categories, setCategories] = useState([]);
    const inputRef = useRef(null);
    const { recent, add: addRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches();
    const { results, total, loading, query: resultQuery } = useProductSearch(query, currentLanguage);

    useEffect(() => {
        let alive = true;
        ProductService.getCategories()
            .then((list) => alive && setCategories(Array.isArray(list) ? list : []))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    const trimmed = query.trim();
    // the idle list / results list (keyed by query) remount at the top, so bring the dock back
    useEffect(() => reveal(), [trimmed, reveal]);
    const matchedCategories = useMemo(() => {
        const q = trimmed.toLowerCase();
        if (q.length < 2) return [];
        return categories
            .filter((c) => `${c.name || ''} ${c.nameHi || ''}`.toLowerCase().includes(q))
            .slice(0, 6);
    }, [categories, trimmed]);

    const runTerm = useCallback(
        (term) => {
            setQuery(term);
            addRecent(term);
            Keyboard.dismiss();
        },
        [addRecent]
    );
    const onSubmit = useCallback(() => addRecent(query), [addRecent, query]);
    const onClear = useCallback(() => {
        setQuery('');
        inputRef.current?.focus();
    }, []);
    const openProduct = useCallback(
        (product) => {
            addRecent(query);
            navigation.navigate('ProductDetail', { product });
        },
        [addRecent, query, navigation]
    );
    const openCategory = useCallback((category) => navigation.navigate('Category', { category }), [navigation]);
    const openCart = useCallback(() => navigation.navigate('Cart'), [navigation]);

    const bottomPad = TAB_BAR_SPACE + insets.bottom + space.lg;
    // Keep showing the previous results while the next query is in flight.
    const showingStale = loading && resultQuery && resultQuery !== trimmed;
    // Same branches SearchResults renders; a change of state crossfades instead of popping.
    const view = !trimmed
        ? 'idle'
        : loading && results.length === 0
          ? 'loading'
          : !loading && results.length === 0 && matchedCategories.length === 0
            ? 'empty'
            : 'results';

    return (
        <Screen background="canvas">
            <SearchHeader
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                onSubmit={onSubmit}
                onBack={navigation.goBack}
                onClear={onClear}
                isHi={isHi}
                fromRect={route?.params?.fromRect}
            />
            <ContentSwap stateKey={view} style={styles.fill}>
            {trimmed ? (
                <SearchResults
                    query={showingStale ? resultQuery : trimmed}
                    results={results}
                    total={total}
                    loading={loading}
                    matchedCategories={matchedCategories}
                    onProductPress={openProduct}
                    onCategory={openCategory}
                    onClear={onClear}
                    isHi={isHi}
                    bottomPad={bottomPad}
                    onScroll={onScroll}
                />
            ) : (
                <SearchIdle
                    recent={recent}
                    onClearRecent={clearRecent}
                    onRemoveRecent={removeRecent}
                    onTerm={runTerm}
                    categories={categories}
                    onCategory={openCategory}
                    isHi={isHi}
                    bottomPad={bottomPad}
                    onScroll={onScroll}
                />
            )}
            </ContentSwap>
            <FloatingCartBar onPress={openCart} bottomOffset={cartBarOffset} />
        </Screen>
    );
};

const styles = { fill: { flex: 1 } };

export default SearchScreen;
