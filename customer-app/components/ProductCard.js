/**
 * ProductCard — the most-seen element in the app (Part C §4).
 *
 *   surface card r12 + hairline (no shadow: cards live on dense grids and rails)
 *   square neutral image well r10 (ProductImage: cut-out pack shot, 8% inset)
 *   green "₹24 off" badge top-left (sentence case) · wishlist heart top-right
 *   ADD (AddToCartButton sm, 64×32) overlapping the well's bottom-right edge → violet stepper
 *   price + struck MRP · name 13/500 on two lines · pack size + clock + store ETA (settings, 10 fallback)
 *   in cart → the hairline turns violet (a state the user acted on)
 *
 * Motion (README §3 "Signature motion")
 *   ADD → a copy of the pack shot flies into the cart target (useFlyToCart); the cart updates at once.
 *   tap → the pack shot travels into the PDP hero (useHeroTransition); the card image hides meanwhile.
 *
 * The layout is deterministic for a given width (square well + fixed text rows), so the
 * heights in PRODUCT_CARD_SIZES are exact and grids/rails never jump.
 *
 * Props
 *   product   card-shaped or raw API product (id/_id, name, price, originalPrice, unit, image,
 *             categoryId, inStock, discount)
 *   onPress   opens the product (usually ProductDetail)
 *   variant   'default' | 'regular' (grids, 156 wide) | 'compact' (rails, 140) | 'large' (176)
 *   style     outer style (pass { width: '100%' } to fill a grid column; the well stays square)
 *   tint      optional image-well colour override
 */
import React, { memo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, incrementQuantity, decrementQuantity } from '../store/slices/cartSlice';
import { toggleWishlistItem } from '../store/slices/wishlistSlice';
import Animated from 'react-native-reanimated';
import { PressableScale, Text, Badge, IconButton, AddToCartButton, PriceTag, useFlyToCart, useHeroTransition, useHeroSourceStyle } from './ui';
import { radii, space } from '../constants/theme';
import { useTheme, makeStyles } from '../theme';
import { press } from '../theme/motion';
import HeartBurst from './product/HeartBurst';
import { normalizeProduct, formatINR } from './product/productUtils';
import ProductImage from './product/ProductImage';
import { useDeliveryEta } from './product/useDeliveryEta';
import { useTranslation } from '../hooks/useTranslation';

/** Card geometry, shared with ProductCardSkeleton. */
export const CARD_PAD = space.xs + 2; // 6
export const CARD_RADIUS = radii.card; // 12 (DESIGN.md "Shape")
export const WELL_RADIUS = radii.well; // 10
/** Everything under the well: body padding + price row + 2 name lines + meta row + card padding. */
export const CARD_BODY_HEIGHT = space.lg + 20 + space.xxs + 36 + space.xs + 16 + space.xs + CARD_PAD;

const heightFor = (width) => CARD_PAD + (width - CARD_PAD * 2) + CARD_BODY_HEIGHT;

/** Geometry per variant. Exported so skeletons and layouts can match it exactly. */
export const PRODUCT_CARD_SIZES = {
    compact: { width: 140, height: heightFor(140), tile: 140 - CARD_PAD * 2 },
    regular: { width: 156, height: heightFor(156), tile: 156 - CARD_PAD * 2 },
    large: { width: 176, height: heightFor(176), tile: 176 - CARD_PAD * 2 },
};
const sizeFor = (variant) => PRODUCT_CARD_SIZES[variant] || PRODUCT_CARD_SIZES.regular;

let cardSeq = 0;

function ProductCardBase({ product: raw, onPress, variant = 'default', style, tint }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const { isHi } = useTranslation();
    const product = normalizeProduct(raw);
    const { id, name, price, originalPrice, unit, image, inStock, discount } = product;

    const quantity = useSelector((s) => s.cart.items.find((it) => it.id === id)?.quantity || 0);
    const wishlisted = useSelector((s) => (s.wishlist?.items || []).some((it) => it.id === id));

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
    const handleAdd = useCallback(() => {
        const { product: p, raw: r } = latest.current;
        fly({ fromRef: wellRef, uri: p.image }); // fire-and-forget: never delays the cart
        dispatch(addToCart({ ...p, name: r?.name || p.name }));
    }, [dispatch, fly]);
    const handleInc = useCallback(() => dispatch(incrementQuantity(latest.current.product.id)), [dispatch]);
    const handleDec = useCallback(() => dispatch(decrementQuantity(latest.current.product.id)), [dispatch]);
    const burst = useRef(null);
    const wishlistedRef = useRef(wishlisted);
    wishlistedRef.current = wishlisted;
    const handleHeart = useCallback(() => {
        const { product: p, raw: r } = latest.current;
        if (!wishlistedRef.current) burst.current?.fire(); // pop only when saving, never when removing
        dispatch(toggleWishlistItem({ ...p, name: r?.name || p.name }));
    }, [dispatch]);

    const size = sizeFor(variant);
    const hasMrp = originalPrice > price;
    const saved = hasMrp ? Math.round(originalPrice - price) : 0;
    const off = isHi ? 'छूट' : 'off';
    const offLabel = saved > 0 ? `₹${formatINR(saved)} ${off}` : discount > 0 ? `${discount}% ${off}` : null;
    const inCart = quantity > 0;
    const eta = useDeliveryEta();

    return (
        <PressableScale
            container
            onPress={handlePress}
            scaleTo={press.subtle}
            style={[styles.card, { width: size.width }, inCart && styles.cardInCart, style]}
            accessibilityLabel={`${name}${unit ? `, ${unit}` : ''}, ₹${formatINR(price)}${inStock ? '' : ', sold out'}`}
            accessibilityHint="Opens product details"
        >
            <View ref={wellRef} collapsable={false} style={[styles.well, tint ? { backgroundColor: tint } : null]}>
                <Animated.View style={[StyleSheet.absoluteFill, heroHide]}>
                    <ProductImage
                        uri={image}
                        variant="card"
                        tint={tint}
                        radius={WELL_RADIUS}
                        dimmed={!inStock}
                        recyclingKey={id}
                        bare
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
                {offLabel && inStock ? <Badge tone="discount" label={offLabel} style={styles.discount} /> : null}
                <View style={styles.heart}>
                    <HeartBurst ref={burst} size={28} />
                    <IconButton
                        name={wishlisted ? 'heart' : 'heart-outline'}
                        size="sm"
                        variant="surface"
                        color={colors.inkSecondary}
                        active={wishlisted}
                        activeColor={colors.error}
                        haptic={wishlisted ? 'light' : 'medium'}
                        onPress={handleHeart}
                        accessibilityLabel={wishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
                    />
                </View>
            </View>

            <AddToCartButton
                size="sm"
                quantity={quantity}
                productName={name}
                outOfStock={!inStock}
                label={isHi ? 'जोड़ें' : 'ADD'}
                outOfStockLabel={isHi ? 'स्टॉक ख़त्म' : 'Sold out'}
                onAdd={handleAdd}
                onIncrement={handleInc}
                onDecrement={handleDec}
                style={styles.add}
            />

            <View style={styles.body}>
                <PriceTag price={price} mrp={hasMrp ? originalPrice : null} size="sm" style={styles.priceRow} />
                <Text variant="label" weight="medium" numberOfLines={2} style={styles.name}>
                    {name}
                </Text>
                <View style={styles.meta}>
                    <Text variant="caption" color="muted" numberOfLines={1} style={styles.unit}>
                        {unit}
                    </Text>
                    {inStock ? (
                        <View style={styles.eta}>
                            {unit ? <View style={styles.dot} /> : null}
                            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.inkMuted} />
                            <Text variant="caption" color="muted" numberOfLines={1}>
                                {isHi ? `${eta} मिनट` : `${eta} mins`}
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>
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
        a.discount === b.discount);

const ProductCard = memo(
    ProductCardBase,
    (prev, next) =>
        sameProduct(prev.product, next.product) &&
        prev.variant === next.variant &&
        prev.tint === next.tint &&
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
    discount: {
        position: 'absolute',
        top: space.sm,
        left: space.sm,
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
    body: {
        paddingHorizontal: space.xs,
        paddingTop: space.lg, // clears the ADD overhang (10) + 6
        paddingBottom: space.xs,
    },
    priceRow: {
        height: 20, // fixed: PRODUCT_CARD_SIZES heights are exact
        flexWrap: 'nowrap',
        overflow: 'hidden',
    },
    name: {
        marginTop: space.xxs,
        minHeight: 36,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: space.xs,
        height: 16,
    },
    unit: {
        flexShrink: 1,
    },
    eta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: t.colors.borderStrong,
        marginHorizontal: space.xs + 1,
    },
}));

export default ProductCard;
