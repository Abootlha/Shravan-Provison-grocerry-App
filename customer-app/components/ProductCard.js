/**
 * ProductCard — the ONE product card (Home rails and tiles, category grid, search, wishlist,
 * PDP rails, checkout upsell). Every size shares the same anatomy:
 *
 *   surface card r12 + hairline (flat: cards live on dense grids and rails)
 *   square image well r10 (ProductImage: cut-out pack shot, 8% inset)
 *     · at most ONE tag top-left, chosen by cardTagOf(): "₹11 off" (≥5%), else "Chilled" /
 *       "Use in 2 days" from the record's own storage / shelf life. Sold out → no tag.
 *     · wishlist heart top-right
 *   ADD (AddToCartButton sm) straddling the well's bottom-right edge → violet stepper.
 *     "+" corner mark and the variant chooser only when the product has more than one pack size.
 *     The stepper's + dims at the stock limit and the meta line says "Only N left".
 *   name 13/500 on two lines
 *   pack size · unit price ("500 g · ₹58/kg", hidden when the pack is the base unit or unreadable)
 *   price + struck MRP
 *   sold out → greyed photo and text, "Notify me" instead of ADD (kept on this device: restockWatch)
 *   in cart → the hairline turns violet (a state the user acted on)
 *
 * Sizes (`variant`)
 *   'rail'  fixed width from PRODUCT_CARD_SIZES (`size`: 'compact' 140 | 'regular' 156 | 'large' 176)
 *   'grid'  fills its column (pass `style={{ width: '100%' }}` or a numeric `width`)
 *   'tile'  same card at an explicit `width` (Home's 2-up produce tiles)
 *   Legacy names still work: 'compact' | 'regular' | 'large' | 'default'.
 *
 * Motion: ADD → a copy of the pack shot flies into the cart target (useFlyToCart); tap → the pack
 * shot travels into the PDP hero (useHeroTransition). Layout is deterministic for a given width,
 * so PRODUCT_CARD_SIZES heights are exact and rails never jump.
 */
import React, { memo, useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import Animated from 'react-native-reanimated';
import { addToCart, incrementQuantity, decrementQuantity } from '../store/slices/cartSlice';
import { toggleWishlistItem } from '../store/slices/wishlistSlice';
import { PressableScale, Text, Badge, IconButton, AddToCartButton, PriceTag, toast, useFlyToCart, useHeroTransition, useHeroSourceStyle } from './ui';
import { radii, space } from '../constants/theme';
import { useTheme, makeStyles } from '../theme';
import { press } from '../theme/motion';
import HeartBurst from './product/HeartBurst';
import { cardTagOf, normalizeProduct, formatINR, shortPackLabel, unitPriceLabel } from './product/productUtils';
import ProductImage from './product/ProductImage';
import VariantSheet from './product/VariantSheet';
import { useTranslation } from '../hooks/useTranslation';
import { unwatchProduct, useRestockWatch } from '../services/restockWatch';

/** Card geometry, shared with ProductCardSkeleton. */
export const CARD_PAD = space.xs + 2; // 6
export const CARD_RADIUS = radii.card; // 12 (DESIGN.md "Shape")
export const WELL_RADIUS = radii.well; // 10
/** Everything under the well: body padding + 2 name lines + meta row + price row + card padding. */
export const CARD_BODY_HEIGHT = space.lg + 36 + space.xxs + 16 + space.xs + 20 + space.xs + CARD_PAD;

const heightFor = (width) => CARD_PAD + (width - CARD_PAD * 2) + CARD_BODY_HEIGHT;

/** Rail geometry per size. Exported so skeletons and layouts can match it exactly. */
export const PRODUCT_CARD_SIZES = {
    compact: { width: 140, height: heightFor(140), tile: 140 - CARD_PAD * 2 },
    regular: { width: 156, height: heightFor(156), tile: 156 - CARD_PAD * 2 },
    large: { width: 176, height: heightFor(176), tile: 176 - CARD_PAD * 2 },
};
export const productCardHeight = heightFor;

/** variant + size → a fixed width (rails), or null (the card fills `style` / `width`). */
const widthFor = (variant, size, width) => {
    if (typeof width === 'number') return width;
    if (variant === 'grid' || variant === 'tile') return null;
    const key = variant === 'rail' ? size || 'compact' : variant;
    return (PRODUCT_CARD_SIZES[key] || PRODUCT_CARD_SIZES.regular).width;
};

let cardSeq = 0;

const COPY = {
    en: { add: 'ADD', soldOut: 'Sold out', notify: 'Notify me', notified: 'Notified', off: 'off', left: (n) => `Only ${n} left`, options: (n) => `${n} options`, chilled: 'Chilled', frozen: 'Frozen', shelf: (d) => (d === 1 ? 'Use in 1 day' : `Use in ${d} days`) },
    hi: { add: 'जोड़ें', soldOut: 'स्टॉक ख़त्म', notify: 'सूचित करें', notified: 'सूचित होगा', off: 'छूट', left: (n) => `सिर्फ़ ${n} बचे`, options: (n) => `${n} विकल्प`, chilled: 'ठंडा रखें', frozen: 'फ़्रोज़न', shelf: (d) => `${d} दिन में खाएँ` },
};

function ProductCardBase({ product: raw, onPress, variant = 'default', size, width, style }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const { isHi } = useTranslation();
    const L = isHi ? COPY.hi : COPY.en;
    const product = normalizeProduct(raw);
    const { id, name, price, originalPrice, unit, image, inStock, stock, options } = product;

    const quantity = useSelector((s) => s.cart.items.find((it) => it.id === id)?.quantity || 0);
    const wishlisted = useSelector((s) => (s.wishlist?.items || []).some((it) => it.id === id));
    const watch = useRestockWatch();
    const watching = !inStock && watch.isWatching(id);
    const [chooser, setChooser] = useState(false);

    // Latest-ref pattern: parents pass inline closures; keep the card memoised regardless.
    const latest = useRef({ product, raw, onPress });
    latest.current = { product, raw, onPress };

    const wellRef = useRef(null);
    const sourceKey = useRef(null);
    if (sourceKey.current == null) sourceKey.current = `card-${++cardSeq}`;
    const fly = useFlyToCart();
    const hero = useHeroTransition();
    const heroHide = useHeroSourceStyle(sourceKey.current);

    const handlePress = useCallback(() => {
        const { product: p, onPress: go } = latest.current;
        if (!go) return;
        hero.start({ fromRef: wellRef, uri: p.image, matchKey: p.id, sourceKey: sourceKey.current });
        go();
    }, [hero]);
    // The cart keeps the source-language name (rows translate on render), not the card's translation.
    const addNow = useCallback(() => {
        const { product: p, raw: r } = latest.current;
        fly({ fromRef: wellRef, uri: p.image }); // fire-and-forget: never delays the cart
        dispatch(addToCart({ ...p, variants: undefined, name: r?.name || p.name }));
        unwatchProduct(p.id); // it's back and in the cart: nothing left to watch for
    }, [dispatch, fly]);
    const handleAdd = useCallback(() => {
        if (latest.current.product.options > 1) setChooser(true);
        else addNow();
    }, [addNow]);
    const handleInc = useCallback(() => dispatch(incrementQuantity(latest.current.product.id)), [dispatch]);
    const handleDec = useCallback(() => dispatch(decrementQuantity(latest.current.product.id)), [dispatch]);
    const burst = useRef(null);
    const wishlistedRef = useRef(wishlisted);
    wishlistedRef.current = wishlisted;
    const handleHeart = useCallback(() => {
        const { product: p, raw: r } = latest.current;
        if (!wishlistedRef.current) burst.current?.fire(); // pop only when saving, never when removing
        dispatch(toggleWishlistItem({ ...p, variants: undefined, name: r?.name || p.name }));
    }, [dispatch]);
    const handleNotify = useCallback(() => {
        const { product: p } = latest.current;
        const on = watch.toggle({ id: p.id, name: p.name });
        if (on) {
            toast.show({
                message: isHi ? 'वापस आने पर यह यहीं दिखेगा' : 'We’ll show it here when it’s back',
                description: isHi ? 'होम पर "फिर से स्टॉक में" देखें। यह सूचना सिर्फ़ इस फ़ोन पर है।' : 'Look for it under “Back in stock” on Home. Saved on this phone only.',
            });
        }
    }, [watch, isHi]);

    const fixedW = widthFor(variant, size, width);
    const hasMrp = originalPrice > price;
    const tag = cardTagOf(product);
    const inCart = quantity > 0;
    const atLimit = inStock && stock != null && stock > 0 && quantity >= stock;
    const pack = shortPackLabel(unit, isHi);
    const perUnit = inStock ? unitPriceLabel(price, unit, isHi) : null;

    let tagEl = null;
    if (tag?.kind === 'discount') {
        tagEl = (
            <View style={styles.tag}>
                <Badge tone="discount" label={`₹${formatINR(tag.amount)} ${L.off}`} />
            </View>
        );
    } else if (tag) {
        const icon = tag.kind === 'shelf' ? 'leaf' : 'snowflake';
        const label = tag.kind === 'shelf' ? L.shelf(tag.days) : tag.kind === 'frozen' ? L.frozen : L.chilled;
        tagEl = (
            <View style={styles.tag}>
                <Badge tone="success" label={label} icon={({ color, size: s }) => <MaterialCommunityIcons name={icon} size={s} color={color} />} />
            </View>
        );
    }

    let meta;
    if (atLimit) {
        meta = (
            <Text variant="caption" weight="semibold" color="error" numberOfLines={1} accessibilityLiveRegion="polite">
                {L.left(stock)}
            </Text>
        );
    } else {
        const tail = options > 1 ? L.options(options) : perUnit;
        meta = (
            <>
                <Text variant="caption" color="muted" numberOfLines={1} style={styles.pack}>
                    {pack}
                </Text>
                {tail && pack ? <View style={styles.dot} /> : null}
                {tail ? (
                    <Text variant="caption" color="muted" numberOfLines={1} style={styles.tail}>
                        {tail}
                    </Text>
                ) : null}
            </>
        );
    }

    const a11y = [name, unit, `₹${formatINR(price)}`, perUnit, inStock ? null : L.soldOut, tag?.kind === 'discount' ? `₹${tag.amount} ${L.off}` : null]
        .filter(Boolean)
        .join(', ');

    return (
        <PressableScale
            container
            onPress={handlePress}
            scaleTo={press.subtle}
            style={[styles.card, fixedW != null && { width: fixedW }, inCart && styles.cardInCart, style]}
            accessibilityLabel={a11y}
            accessibilityHint="Opens product details"
        >
            <View ref={wellRef} collapsable={false} style={styles.well}>
                <Animated.View style={[StyleSheet.absoluteFill, heroHide]}>
                    <ProductImage uri={image} variant="card" radius={WELL_RADIUS} dimmed={!inStock} recyclingKey={id} bare style={StyleSheet.absoluteFill} />
                </Animated.View>
                {tagEl}
                <View style={styles.heart}>
                    <HeartBurst ref={burst} size={28} />
                    <IconButton
                        name={wishlisted ? 'heart' : 'heart-outline'}
                        size="sm"
                        variant="surface"
                        color={colors.inkSecondary}
                        active={wishlisted}
                        activeColor={colors.errorInk}
                        haptic={wishlisted ? 'light' : 'medium'}
                        onPress={handleHeart}
                        accessibilityLabel={
                            isHi
                                ? wishlisted
                                    ? `${name} विशलिस्ट से हटाएँ`
                                    : `${name} विशलिस्ट में जोड़ें`
                                : wishlisted
                                  ? `Remove ${name} from wishlist`
                                  : `Add ${name} to wishlist`
                        }
                    />
                </View>
            </View>

            {inStock ? (
                <AddToCartButton
                    size="sm"
                    quantity={quantity}
                    productName={name}
                    max={stock != null && stock > 0 ? stock : undefined}
                    options={options}
                    label={L.add}
                    onAdd={handleAdd}
                    onIncrement={handleInc}
                    onDecrement={handleDec}
                    style={styles.add}
                />
            ) : (
                <PressableScale
                    onPress={handleNotify}
                    haptic="light"
                    style={[styles.add, styles.notify, watching && styles.notifyOn]}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: watching }}
                    accessibilityLabel={watching ? `${name}: ${L.notified}. ${isHi ? 'रोकने के लिए टैप करें' : 'Tap to stop'}` : `${L.notify}: ${name}`}
                >
                    <MaterialCommunityIcons name={watching ? 'bell-check-outline' : 'bell-outline'} size={14} color={colors.brandText} />
                    <Text variant="caption" weight="bold" color="brand" numberOfLines={1}>
                        {watching ? L.notified : L.notify}
                    </Text>
                </PressableScale>
            )}

            <View style={styles.body}>
                <Text variant="label" weight="medium" color={inStock ? 'ink' : 'secondary'} numberOfLines={2} style={styles.name}>
                    {name}
                </Text>
                <View style={styles.meta}>{meta}</View>
                <View style={styles.priceRow}>
                    {inStock ? (
                        <PriceTag price={price} mrp={hasMrp ? originalPrice : null} size="sm" style={styles.price} />
                    ) : (
                        <Text variant="caption" weight="semibold" color="secondary" numberOfLines={1}>
                            {L.soldOut} · ₹{formatINR(price)}
                        </Text>
                    )}
                </View>
            </View>

            {chooser ? (
                <VariantSheet
                    visible={chooser}
                    onClose={() => setChooser(false)}
                    product={product}
                    cartName={raw?.name || name}
                    isHi={isHi}
                    onAdded={() => unwatchProduct(id)}
                />
            ) : null}
        </PressableScale>
    );
}

const sameProduct = (a, b) =>
    a === b ||
    (!!a &&
        !!b &&
        (a.id || a._id) === (b.id || b._id) &&
        a.name === b.name &&
        a.translatedName === b.translatedName &&
        a.price === b.price &&
        a.originalPrice === b.originalPrice &&
        a.image === b.image &&
        a.unit === b.unit &&
        a.inStock === b.inStock &&
        a.stock === b.stock &&
        a.discount === b.discount &&
        a.options === b.options);

const ProductCard = memo(
    ProductCardBase,
    (prev, next) =>
        sameProduct(prev.product, next.product) &&
        prev.variant === next.variant &&
        prev.size === next.size &&
        prev.width === next.width &&
        prev.style === next.style &&
        !!prev.onPress === !!next.onPress
);

/** The 32px ADD straddles the well's bottom edge: 22 over the image, 10 below it. */
const ADD_OVERHANG = space.sm + 2;
const ADD_OVERHANG_TOP = 32 - ADD_OVERHANG;

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
    cardInCart: {
        borderColor: t.colors.brand,
    },
    well: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: WELL_RADIUS,
        backgroundColor: t.colors.imageWell, // stays put while the image itself is in flight
    },
    // The tag sits on the pack shot: an opaque surface backing keeps the (translucent in dark)
    // savings tint readable over any photo.
    tag: {
        position: 'absolute',
        top: space.sm,
        left: space.sm,
        maxWidth: '68%',
        borderRadius: radii.xs,
        overflow: 'hidden',
        backgroundColor: t.colors.surface,
    },
    heart: {
        position: 'absolute',
        top: space.xxs,
        right: space.xxs,
    },
    add: {
        alignSelf: 'flex-end',
        marginTop: -ADD_OVERHANG_TOP,
        marginRight: space.xs,
        marginBottom: -ADD_OVERHANG,
        zIndex: 1,
    },
    notify: {
        height: 32,
        minWidth: 64,
        paddingHorizontal: space.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        borderRadius: radii.add,
        borderWidth: 1,
        borderColor: t.colors.brand,
        backgroundColor: t.colors.surfaceRaised,
    },
    notifyOn: {
        backgroundColor: t.colors.brandTint,
        borderColor: t.colors.brandTint,
    },
    body: {
        paddingHorizontal: space.xs,
        paddingTop: space.lg, // clears the ADD overhang (10) + 6
        paddingBottom: space.xs,
    },
    name: {
        minHeight: 36,
        height: 36,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: space.xxs,
        height: 16,
    },
    pack: { flexShrink: 0, maxWidth: '100%' }, // the pack size is what matters; the per-unit price gives way
    tail: { flexShrink: 1 },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: t.colors.inkMuted, marginHorizontal: space.xs + 1 },
    priceRow: {
        marginTop: space.xs,
        height: 20, // fixed: PRODUCT_CARD_SIZES heights are exact
        justifyContent: 'center',
    },
    price: {
        flexWrap: 'nowrap',
        overflow: 'hidden',
    },
}));

export default ProductCard;
