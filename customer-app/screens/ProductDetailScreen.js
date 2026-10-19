/**
 * ProductDetailScreen (Part C §8) — full-bleed hero on the flat neutral image well with pager dots
 * (tap opens the full-screen viewer), a surface r16 sheet overlapping it with sentence-case badges
 * (clock + ETA, veg, fresh), name 20/700, PriceTag 28/800 + green savings, spring accordions, a
 * "You might also like" rail and a sticky stepper + 52px violet CTA footer. Glass back/share/heart
 * float over the hero; a solid titled header fades in as you scroll.
 *
 * Route params: { product } — a raw API product or a card-shaped one (wishlist / cart).
 * The full product is refreshed from GET /products/:id in the background.
 *
 * Motion: the hero pack shot is the destination of the card → PDP shared-element flight
 * (useHeroTarget; flies back to the card on pop), and "Add to cart" flies the pack shot into the
 * CTA (useFlyToCart). The screen itself cross-fades (AppNavigator PDP_OPTIONS).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Share, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, incrementQuantity, decrementQuantity } from '../store/slices/cartSlice';
import { toggleWishlistItem } from '../store/slices/wishlistSlice';
import { Screen, Text, Badge, Chip, Divider, PriceTag, toast, useFlyToCart, useHeroTarget } from '../components/ui';
import { unwatchProduct, useRestockWatch } from '../services/restockWatch';
import { radii, space } from '../constants/theme';
import { useTheme, makeStyles } from '../theme';
import { useTranslation } from '../hooks/useTranslation';
import { useDeliveryEta } from '../components/product/useDeliveryEta';
import { translateToHindi } from '../services/translationService';
import { ProductService } from '../services/services';
import ImageGallery from '../components/product/ImageGallery';
import ImageViewer from '../components/product/ImageViewer';
import AccordionSection, { sectionLayout } from '../components/product/AccordionSection';
import ProductRail from '../components/product/ProductRail';
import { PdpHeader, PdpBottomBar } from '../components/product/PdpChrome';
import { DescriptionText, NutritionTable, hasNutrition, productHighlights } from '../components/product/PdpDetails';
import { InfoRow } from '../components/product/AccordionSection';
import { contentColumn, useContentWidth } from '../hooks/useContentWidth';
import {
    formatINR,
    getCategoryId,
    getDiscountPercent,
    getImages,
    getMrp,
    getPrice,
    getProductId,
    getStock,
    getSubcategoryId,
    getUnit,
    isInStock,
    normalizeProduct,
    activeVariants,
    defaultVariantOf,
    unitPriceLabel,
    variantLineOf,
} from '../components/product/productUtils';

const BOTTOM_BAR_SPACE = 104;
const HI_PRICE_LABELS = { save: 'बचत', off: 'छूट' };
const ClockIcon = ({ color, size }) => <MaterialCommunityIcons name="clock-outline" color={color} size={size} />;
function VegIcon({ size }) {
    const { colors } = useTheme();
    return <MaterialCommunityIcons name="square-circle" color={colors.veg} size={size} />;
}
const LeafIcon = ({ color, size }) => <MaterialCommunityIcons name="leaf" color={color} size={size} />;

const useTranslatedProduct = (product, currentLanguage) => {
    const [translated, setTranslated] = useState(product);
    useEffect(() => {
        let alive = true;
        if (currentLanguage !== 'hi') {
            setTranslated(product);
            return undefined;
        }
        (async () => {
            try {
                const next = {
                    ...product,
                    name: product.nameHi || (await translateToHindi(product.name)),
                    description:
                        product.descriptionHi || (product.description ? await translateToHindi(product.description) : product.description),
                    highlights:
                        product.highlightsHi || (product.highlights ? await translateToHindi(product.highlights) : product.highlights),
                    brand: product.brandHi || (product.brand ? await translateToHindi(product.brand) : product.brand),
                };
                if (alive) setTranslated(next);
            } catch (err) {
                console.error('Translation error:', err);
                if (alive) setTranslated(product);
            }
        })();
        return () => {
            alive = false;
        };
    }, [currentLanguage, product]);
    return translated;
};

const ProductDetailScreen = ({ route, navigation }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const routeProduct = route.params?.product || {};
    const { currentLanguage, isHi } = useTranslation();
    const eta = useDeliveryEta(isHi); // from the store settings only; no chip while unknown
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const width = useContentWidth();

    const productId = getProductId(routeProduct);
    const [fetched, setFetched] = useState(null);
    const [similar, setSimilar] = useState([]);
    const [similarLoading, setSimilarLoading] = useState(true);
    const [viewer, setViewer] = useState({ visible: false, index: 0 });
    const [expanded, setExpanded] = useState({ highlights: true, details: false, nutrition: false });
    const [sameShelf, setSameShelf] = useState([]); // in-stock items from the same subcategory (shown when this one is sold out)

    const product = useMemo(() => ({ ...routeProduct, ...(fetched || {}), id: productId }), [routeProduct, fetched, productId]);
    const shown = useTranslatedProduct(product, currentLanguage);

    // Pack sizes: the chips pick one, and price / MRP / stock / the cart line follow it. The
    // default pack is the product's own line (same id as the cards use).
    const variants = useMemo(() => activeVariants(product), [product]);
    const [pickedSku, setPickedSku] = useState(null);
    const selectedVariant =
        variants.length > 1 ? variants.find((v) => v.sku === pickedSku) || variants.find((v) => v.sku === defaultVariantOf(product)?.sku) || variants[0] : null;
    const variantLine = useMemo(
        () => (selectedVariant ? variantLineOf(product, selectedVariant, product.name) : null),
        [product, selectedVariant],
    );
    const lineId = variantLine ? variantLine.id : productId;
    const price = variantLine ? variantLine.price : getPrice(product);
    const mrp = variantLine ? variantLine.originalPrice : getMrp(product);
    const unit = variantLine ? variantLine.unit : getUnit(product);
    const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : getDiscountPercent(product);
    const inStock = variantLine ? variantLine.inStock && product.isAvailable !== false : isInStock(product);
    const images = useMemo(() => getImages(product), [product]);
    const categoryId = getCategoryId(product);
    const reviewCount = Number(product.reviewCount ?? product.reviews) || 0;
    const rating = Number(product.rating) || 0;
    const dietary = product.attributes?.dietary || [];
    const isVeg = dietary.some((d) => /^veg/i.test(String(d))) || product.isVeg === true;
    const fresh = product.isPerishable === true || (Number(product.shelfLife) > 0 && Number(product.shelfLife) <= 7);
    const stock = variantLine ? variantLine.stock : getStock(product);
    const subcategoryId = getSubcategoryId(product);
    const cartProduct = useMemo(() => ({ ...product, ...normalizeProduct(product), variants: undefined, name: product.name }), [product]);
    const watch = useRestockWatch();
    const watching = !inStock && watch.isWatching(productId);

    const quantity = useSelector((s) => s.cart.items.find((it) => it.id === lineId)?.quantity || 0);
    const wishlisted = useSelector((s) => (s.wishlist?.items || []).some((it) => it.id === productId));

    // Refresh the full product (wishlist/cart entries only carry the card fields).
    useEffect(() => {
        let alive = true;
        if (!productId) return undefined;
        ProductService.getProductById(productId)
            .then((p) => alive && p && setFetched(p))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [productId]);

    // "You might also like": same category from the API.
    useEffect(() => {
        let alive = true;
        if (!categoryId) {
            setSimilarLoading(false);
            return undefined;
        }
        setSimilarLoading(true);
        ProductService.getProducts({ categoryId, limit: 12 })
            .then((res) => {
                if (!alive) return;
                // in-stock first, so the rail leads with things that can be added right now
                const list = (res?.products || []).filter((p) => getProductId(p) !== productId);
                setSimilar([...list.filter(isInStock), ...list.filter((p) => !isInStock(p))].slice(0, 10));
            })
            .catch(() => alive && setSimilar([]))
            .finally(() => alive && setSimilarLoading(false));
        return () => {
            alive = false;
        };
    }, [categoryId, productId]);

    // Sold out: offer what IS on the same shelf (same subcategory, in stock).
    useEffect(() => {
        let alive = true;
        if (inStock || !subcategoryId) {
            setSameShelf([]);
            return undefined;
        }
        ProductService.getProducts({ subcategoryId, limit: 20 })
            .then((res) => alive && setSameShelf((res?.products || []).filter((p) => getProductId(p) !== productId && isInStock(p)).slice(0, 10)))
            .catch(() => alive && setSameShelf([]));
        return () => {
            alive = false;
        };
    }, [inStock, subcategoryId, productId]);

    // A square-ish hero: the pack shot is the page (Part C section 8), capped so the name stays above the fold.
    const heroHeight = Math.round(Math.min(Math.max(width, 320) * 1.02, 440));
    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((e) => {
        scrollY.value = e.contentOffset.y;
    });

    const heroTarget = useHeroTarget(productId);
    const fly = useFlyToCart();
    useEffect(() => {
        const reverse = heroTarget.reverse;
        const offRemove = navigation.addListener('beforeRemove', reverse);
        const offTransition = navigation.addListener('transitionStart', (e) => e?.data?.closing && reverse());
        return () => {
            offRemove();
            offTransition();
        };
    }, [navigation, heroTarget.reverse]);

    // The "You might also like" rail sits below the fold: mount it once the push transition has
    // settled, so the PDP's first frame (and the hero flight) don't also pay for skeleton cards.
    const [settled, setSettled] = useState(false);
    useEffect(() => {
        const off = navigation.addListener('transitionEnd', (e) => !e?.data?.closing && setSettled(true));
        const fallback = setTimeout(() => setSettled(true), 450); // no transition event (web, reduced motion)
        return () => {
            off();
            clearTimeout(fallback);
        };
    }, [navigation]);

    const heroUri = images[0];
    const onAdd = useCallback(() => {
        fly({ fromRef: heroTarget.ref, uri: heroUri, inset: 0.1 }); // fire-and-forget
        dispatch(addToCart(variantLine || cartProduct));
        unwatchProduct(productId);
    }, [dispatch, cartProduct, variantLine, fly, heroUri, heroTarget.ref, productId]);
    const onNotify = useCallback(() => {
        const on = watch.toggle({ id: productId, name: product.name });
        if (on) {
            toast.show({
                message: isHi ? 'वापस आने पर यह यहीं दिखेगा' : 'We’ll show it here when it’s back',
                description: isHi ? 'होम पर "फिर से स्टॉक में" देखें। यह सूचना सिर्फ़ इस फ़ोन पर है।' : 'Look for it under “Back in stock” on Home. Saved on this phone only.',
            });
        }
    }, [watch, productId, product.name, isHi]);
    const onMaxReached = useCallback(
        () => toast.info(isHi ? `सिर्फ़ ${stock} बचे हैं` : `Only ${stock} left in stock`),
        [isHi, stock],
    );
    const onInc = useCallback(() => dispatch(incrementQuantity(lineId)), [dispatch, lineId]);
    const onDec = useCallback(() => dispatch(decrementQuantity(lineId)), [dispatch, lineId]);
    const onWishlist = useCallback(() => dispatch(toggleWishlistItem(normalizeProduct(product))), [dispatch, product]);
    const onShare = useCallback(() => {
        Share.share({ message: `${shown.name}${unit ? ` (${unit})` : ''} for ₹${formatINR(price)} on Shravan Kirana` }).catch(() => {});
    }, [shown.name, unit, price]);
    const openViewer = useCallback((index) => setViewer({ visible: true, index }), []);
    const closeViewer = useCallback(() => setViewer((v) => ({ ...v, visible: false })), []);
    const [lastToggled, setLastToggled] = useState(null);
    const toggle = (key) => {
        setLastToggled(key);
        setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    const openCart = useCallback(() => navigation.navigate('Main', { screen: 'Cart' }), [navigation]);
    const openSimilar = useCallback((item) => navigation.push('ProductDetail', { product: item }), [navigation]);

    const highlights = productHighlights({ ...product, brand: shown.brand, unit, price, highlights: shown.highlights }, isHi);
    const showNutrition = hasNutrition(product.nutrition);

    return (
        <Screen edges={[]}>
            <View style={contentColumn}>
            <Animated.ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: BOTTOM_BAR_SPACE + insets.bottom }}
            >
                <ImageGallery
                    images={images}
                    height={heroHeight + insets.top}
                    topInset={insets.top}
                    onOpen={openViewer}
                    productName={shown.name}
                    heroRef={heroTarget.ref}
                    heroStyle={heroTarget.style}
                    onHeroLayout={heroTarget.onLayout}
                    onHeroLoad={heroTarget.onLoad}
                />

                <View style={styles.sheet}>
                    <View style={styles.chips}>
                        {inStock && (eta.closedLabel || eta.minutes) ? (
                            <Badge
                                tone="neutral"
                                size="md"
                                label={eta.closedLabel || (isHi ? `${eta.minutes} मिनट` : `${eta.minutes} mins`)}
                                icon={ClockIcon}
                            />
                        ) : null}
                        {isVeg ? <Badge tone="success" size="md" label={isHi ? 'शाकाहारी' : 'Veg'} icon={VegIcon} /> : null}
                        {fresh ? <Badge tone="neutral" size="md" label={isHi ? 'ताज़ा' : 'Fresh'} icon={LeafIcon} /> : null}
                    </View>

                    {shown.brand ? (
                        <Text variant="label" color="secondary" style={styles.brand}>
                            {shown.brand}
                        </Text>
                    ) : null}
                    <Text variant="h2" style={styles.name} accessibilityRole="header">
                        {shown.name}
                    </Text>
                    <View style={styles.subRow}>
                        {unit ? (
                            <Text variant="body" color="muted">
                                {unit}
                            </Text>
                        ) : null}
                        {rating > 0 ? (
                            <View style={styles.rating} accessibilityLabel={isHi ? `${reviewCount} समीक्षाओं से 5 में से ${rating} रेटिंग` : `Rated ${rating} out of 5 from ${reviewCount} reviews`}>
                                {unit ? <View style={styles.sep} /> : null}
                                <MaterialCommunityIcons name="star" size={14} color={colors.rating} />
                                <Text variant="label">{rating.toFixed(1)}</Text>
                                {reviewCount > 0 ? (
                                    <Text variant="caption" color="muted">
                                        ({formatINR(reviewCount)} {isHi ? 'समीक्षाएँ' : reviewCount === 1 ? 'review' : 'reviews'})
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}
                    </View>

                    {variants.length > 1 ? (
                        <View style={styles.variants}>
                            {variants.map((v) => {
                                const current = v.sku === selectedVariant?.sku;
                                const out = !(Number(v.stock) > 0);
                                const per = unitPriceLabel(v.sellingPrice, v.unit, isHi);
                                return (
                                    <Chip
                                        key={v.sku || v.unit}
                                        size="md"
                                        label={v.unit}
                                        caption={out ? (isHi ? 'स्टॉक ख़त्म' : 'Sold out') : `₹${formatINR(v.sellingPrice)}${per ? ` · ${per}` : ''}`}
                                        selected={current}
                                        onPress={() => setPickedSku(v.sku)}
                                        accessibilityState={{ selected: current }}
                                    />
                                );
                            })}
                        </View>
                    ) : null}

                    <View style={styles.priceBlock}>
                        <PriceTag price={price} mrp={mrp > price ? mrp : undefined} size="lg" showSave={mrp > price ? 'amount' : false} labels={isHi ? HI_PRICE_LABELS : undefined} />
                        <Text variant="caption" color="muted" style={styles.taxes}>
                            {mrp > price
                                ? isHi
                                    ? `MRP ₹${formatINR(mrp)} · ${discount}% की छूट · सभी कर शामिल`
                                    : `MRP ₹${formatINR(mrp)} · ${discount}% off · incl. of all taxes`
                                : isHi
                                  ? 'सभी कर शामिल'
                                  : 'Inclusive of all taxes'}
                        </Text>
                    </View>
                    {!inStock ? (
                        <Badge tone="error" size="md" label={isHi ? 'स्टॉक में नहीं' : 'Out of stock'} style={styles.oos} />
                    ) : null}

                    <Divider spacing={space.lg} />

                    {highlights.length ? (
                        <AccordionSection title={isHi ? 'मुख्य बातें' : 'Highlights'} expanded={expanded.highlights} animateLayout={lastToggled !== 'highlights'} onToggle={() => toggle('highlights')}>
                            {highlights.map(([label, value], i) => (
                                <InfoRow key={`${label}-${i}`} label={label} value={value} last={i === highlights.length - 1} />
                            ))}
                        </AccordionSection>
                    ) : null}
                    {shown.description ? (
                        <AccordionSection title={isHi ? 'उत्पाद विवरण' : 'Product details'} expanded={expanded.details} animateLayout={lastToggled !== 'details'} onToggle={() => toggle('details')}>
                            <DescriptionText text={shown.description} />
                        </AccordionSection>
                    ) : null}
                    {showNutrition ? (
                        <AccordionSection title={isHi ? 'पोषण जानकारी' : 'Nutritional information'} expanded={expanded.nutrition} animateLayout={lastToggled !== 'nutrition'} onToggle={() => toggle('nutrition')} last>
                            <NutritionTable nutrition={product.nutrition} />
                        </AccordionSection>
                    ) : null}
                </View>

                {!inStock && sameShelf.length ? (
                    <ProductRail
                        title={isHi ? 'इसी तरह के सामान, स्टॉक में' : 'Similar items in stock'}
                        products={sameShelf}
                        onProductPress={openSimilar}
                    />
                ) : null}

                {settled ? (
                    <Animated.View layout={sectionLayout}>
                        <ProductRail
                            title={isHi ? 'आपको यह भी पसंद आ सकता है' : 'You might also like'}
                            products={sameShelf.length ? similar.filter((p) => !sameShelf.some((x) => getProductId(x) === getProductId(p))) : similar}
                            loading={similarLoading}
                            onProductPress={openSimilar}
                        />
                    </Animated.View>
                ) : null}
            </Animated.ScrollView>

            <PdpHeader
                scrollY={scrollY}
                fadeStart={heroHeight * 0.45}
                fadeEnd={heroHeight - 40}
                topInset={insets.top}
                title={shown.name}
                wishlisted={wishlisted}
                onBack={navigation.goBack}
                onShare={onShare}
                onWishlist={onWishlist}
            />

            <PdpBottomBar
                price={price}
                mrp={mrp}
                quantity={quantity}
                inStock={inStock}
                max={stock != null && stock > 0 ? stock : undefined}
                onMaxReached={onMaxReached}
                watching={watching}
                onNotify={onNotify}
                bottomInset={insets.bottom}
                productName={shown.name}
                isHi={isHi}
                onAdd={onAdd}
                onIncrement={onInc}
                onDecrement={onDec}
                onViewCart={openCart}
            />

            <ImageViewer
                visible={viewer.visible}
                images={images}
                initialIndex={viewer.index}
                onClose={closeViewer}
                productName={shown.name}
            />
            </View>
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    sheet: {
        marginTop: -radii.sheet,
        backgroundColor: t.colors.surface,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
        paddingHorizontal: space.lg,
        paddingTop: space.xl,
        paddingBottom: space.sm,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
        marginBottom: space.lg,
    },
    rating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
    sep: { width: 3, height: 3, borderRadius: 2, backgroundColor: t.colors.borderStrong, marginHorizontal: space.xs },
    brand: { marginBottom: space.xxs },
    name: { fontSize: 20, lineHeight: 26 },
    subRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: space.xs },
    variants: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space.sm,
        marginTop: space.lg,
    },
    priceBlock: {
        marginTop: space.xl,
    },
    taxes: { marginTop: space.xxs },
    oos: { alignSelf: 'flex-start', marginTop: space.md },
}));

export default ProductDetailScreen;
