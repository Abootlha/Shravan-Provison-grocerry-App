/**
 * SearchScreen — live product search against the real API (GET /products?search=).
 *
 *   idle      recent searches (this phone, clearable) · Buy again (delivered orders, in stock now)
 *             · Popular right now (best sellers by soldCount) · category shortcuts
 *   typing    up to 6 suggestions from real catalogue names, matched part in bold
 *   results   "Showing results for ‘milk’" when Hindi/Hinglish or a typo was corrected (with
 *             "Search instead for ‘doodh’"), matching categories, then the product grid
 *   nothing   no-results recovery: request the item from the store (WhatsApp to the store's own
 *             number, only when the settings carry one), category shortcuts, popular items
 *
 * Route params: { fromRect } — optional window rect of Home's search bar; the field springs from
 * it into place (SearchHeader). Idle ↔ loading ↔ results ↔ empty crossfade through ContentSwap.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Linking } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ContentSwap, Screen, toast } from '../components/ui';
import FloatingCartBar from '../components/FloatingCartBar';
import { useCartBarOffset, useTabBarScroll } from '../components/BottomTabsIcons';
import { space } from '../constants/theme';
import { useTranslation } from '../hooks/useTranslation';
import { useStoreSettings } from '../hooks/useStoreSettings';
import { OrderService, ProductService } from '../services/services';
import { translateToHindi } from '../services/translationService';
import SearchHeader from './search/SearchHeader';
import SearchIdle from './search/SearchIdle';
import SearchResults from './search/SearchResults';
import SearchSuggestions from './search/SearchSuggestions';
import useProductSearch from './search/useProductSearch';
import useRecentSearches from './search/useRecentSearches';
import useSearchCatalog from './search/useSearchCatalog';
import { normalizeText } from './search/searchSynonyms';
import { buyAgain as buyAgainFrom } from './home/collections';

/** Space for the floating tab bar + cart bar under the list. */
const TAB_BAR_SPACE = 200;
const IDLE_RAIL = 10;

/** WhatsApp link to the store's own number (Indian 10-digit numbers get the 91 prefix). */
const whatsappUrl = (phone, text) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    const full = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
};

/** Adds `translatedName` (nameHi, else machine translation) for Hindi, like Home/Category. */
function useHindiNames(list, isHi) {
    const [out, setOut] = useState(list);
    useEffect(() => {
        let alive = true;
        if (!isHi || !list.length) {
            setOut(list);
            return undefined;
        }
        Promise.all(list.map(async (p) => ({ ...p, translatedName: p.nameHi || (await translateToHindi(p.name)) })))
            .then((next) => alive && setOut(next))
            .catch(() => alive && setOut(list));
        return () => {
            alive = false;
        };
    }, [list, isHi]);
    return out;
}

const SearchScreen = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const cartBarOffset = useCartBarOffset();
    const { onScroll, reveal } = useTabBarScroll(navigation);
    const { currentLanguage, isHi } = useTranslation();
    const { settings } = useStoreSettings();
    const userId = useSelector((s) => s.auth?.user?.id || s.auth?.user?._id);
    const [query, setQuery] = useState('');
    const [submitted, setSubmitted] = useState(''); // the term a suggestion / recent / Enter committed
    const [exact, setExact] = useState(false); // "Search instead for …": no synonym / typo help
    const [categories, setCategories] = useState([]);
    const [orders, setOrders] = useState([]);
    const inputRef = useRef(null);
    const catalog = useSearchCatalog({ isHi });
    const { recent, add: addRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches();
    const {
        results,
        total,
        loading,
        error: searchError,
        retry: retrySearch,
        query: resultQuery,
        corrected,
    } = useProductSearch(query, currentLanguage, { vocabulary: catalog.vocabulary, exact });

    useEffect(() => {
        let alive = true;
        ProductService.getCategories()
            .then((list) => alive && setCategories(Array.isArray(list) ? list : []))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    // Past orders feed "Buy again" (failures just hide the row).
    useEffect(() => {
        let alive = true;
        if (!userId) return undefined;
        OrderService.getOrders(userId)
            .then((res) => alive && setOrders(Array.isArray(res) ? res : res?.orders || []))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [userId]);

    const buyAgainRaw = useMemo(() => buyAgainFrom(catalog.popular, orders).slice(0, IDLE_RAIL), [catalog.popular, orders]);
    const popularRaw = useMemo(() => catalog.popular.slice(0, IDLE_RAIL), [catalog.popular]);
    const buyAgain = useHindiNames(buyAgainRaw, isHi);
    const popular = useHindiNames(popularRaw, isHi);

    const trimmed = query.trim();
    // the idle list / results list (keyed by query) remount at the top, so bring the dock back
    useEffect(() => reveal(), [trimmed, reveal]);
    const matchedCategories = useMemo(() => {
        const q = normalizeText(trimmed);
        if (q.length < 2) return [];
        return categories.filter((c) => normalizeText(`${c.name || ''} ${c.nameHi || ''}`).includes(q)).slice(0, 6);
    }, [categories, trimmed]);

    const changeText = useCallback((text) => {
        setQuery(text);
        setExact(false);
    }, []);
    const runTerm = useCallback(
        (term) => {
            setQuery(term);
            setSubmitted(term.trim());
            setExact(false);
            addRecent(term);
            Keyboard.dismiss();
        },
        [addRecent],
    );
    const onSubmit = useCallback(() => {
        setSubmitted(query.trim());
        addRecent(query);
    }, [addRecent, query]);
    const onClear = useCallback(() => {
        setQuery('');
        setSubmitted('');
        setExact(false);
        inputRef.current?.focus();
    }, []);
    const onExact = useCallback(() => {
        setExact(true);
        setSubmitted(query.trim());
    }, [query]);
    const openProduct = useCallback(
        (product) => {
            addRecent(query);
            navigation.navigate('ProductDetail', { product });
        },
        [addRecent, query, navigation],
    );
    const openCategory = useCallback((category) => navigation.navigate('Category', { category }), [navigation]);
    const openCart = useCallback(() => navigation.navigate('Cart'), [navigation]);

    const requestUrl = whatsappUrl(
        settings?.contactPhone,
        isHi ? `नमस्ते! क्या आप "${trimmed}" रख सकते हैं? मुझे यह ऐप में नहीं मिला।` : `Hi! Could you stock "${trimmed}"? I couldn't find it in the app.`,
    );
    const onRequest = useMemo(
        () =>
            requestUrl
                ? () =>
                      Linking.openURL(requestUrl).catch(() =>
                          toast.error(isHi ? 'WhatsApp नहीं खुल सका' : 'Couldn’t open WhatsApp', {
                              description: isHi ? `दुकान को ${settings.contactPhone} पर कॉल करें` : `Call the store on ${settings.contactPhone}`,
                          }),
                      )
                : undefined,
        [requestUrl, isHi, settings?.contactPhone],
    );

    const bottomPad = TAB_BAR_SPACE + insets.bottom + space.lg;
    // Keep showing the previous results while the next query is in flight.
    const showingStale = loading && resultQuery && resultQuery !== trimmed;
    // Suggestions while the shopper is still typing (hidden once a term is committed).
    const typing = trimmed.length >= 2 && trimmed !== submitted;
    const suggestions = typing ? (
        <SearchSuggestions
            query={trimmed}
            products={catalog.products}
            categories={categories}
            vocabulary={catalog.vocabulary}
            isHi={isHi}
            onTerm={runTerm}
            onCategory={openCategory}
        />
    ) : null;
    // Same branches SearchResults renders; a change of state crossfades instead of popping.
    const view = !trimmed
        ? 'idle'
        : loading && results.length === 0
          ? 'loading'
          : !loading && searchError && results.length === 0
            ? 'error'
            : !loading && results.length === 0 && matchedCategories.length === 0
              ? 'empty'
              : 'results';

    return (
        <Screen background="canvas">
            <SearchHeader
                ref={inputRef}
                value={query}
                onChangeText={changeText}
                onSubmit={onSubmit}
                onBack={navigation.getState?.()?.type === 'tab' ? undefined : navigation.goBack}
                onClear={onClear}
                isHi={isHi}
                fromRect={route?.params?.fromRect}
                hints={catalog.names.slice(0, 12)}
            />
            <ContentSwap stateKey={view} style={styles.fill}>
                {trimmed ? (
                    <SearchResults
                        query={showingStale ? resultQuery : trimmed}
                        results={results}
                        total={total}
                        loading={loading}
                        error={searchError}
                        onRetry={retrySearch}
                        matchedCategories={matchedCategories}
                        onProductPress={openProduct}
                        onCategory={openCategory}
                        onClear={onClear}
                        isHi={isHi}
                        bottomPad={bottomPad}
                        onScroll={onScroll}
                        corrected={exact ? null : corrected}
                        onExact={onExact}
                        suggestions={suggestions}
                        categories={categories}
                        popular={popular}
                        onRequest={onRequest}
                    />
                ) : (
                    <SearchIdle
                        recent={recent}
                        onClearRecent={clearRecent}
                        onRemoveRecent={removeRecent}
                        onTerm={runTerm}
                        categories={categories}
                        onCategory={openCategory}
                        buyAgain={buyAgain}
                        popular={popular}
                        onProduct={openProduct}
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
