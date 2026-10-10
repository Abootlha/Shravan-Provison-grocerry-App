/**
 * ProductImage — the one way to draw a product picture (cards, PDP gallery, cart rows,
 * order thumbnails, the cart-pill stack): a cut-out pack shot, consistently scaled, on the flat
 * neutral image well (DESIGN.md). No well light, no gradient contact shadow — flat.
 *
 *   well        colors.imageWell (or `tint`), radius per variant (well 10), clips its content
 *   product     expo-image, contentFit "contain", inset 8% of the well on every side
 *   loading     neutral shimmer until the first frame decodes, then a 180ms cross-dissolve
 *   missing     no uri or a failed load → a flat neutral shopping-bag glyph
 *
 * Catalogue contract: product images should be transparent PNG/WebP cut-outs (the admin
 * "Remove background" pipeline produces them). On web, white-background photos are blended
 * with mix-blend-mode: multiply so their white melts into the well. Native has no per-view
 * blend for expo-image, so on iOS/Android a white background shows as a white tile: native
 * needs real cut-outs.
 *
 * Props
 *   uri            image URL (string). Falsy → placeholder glyph.
 *   variant        'card' (default) | 'hero' (PDP gallery, larger inset + shadow) | 'thumb' (rows, stacks)
 *   size           number → square width/height. Omit and pass style (e.g. { width: '100%', aspectRatio: 1 }).
 *   style          outer well style (radius, border, background overrides)
 *   tint           well colour override
 *   bare           skip the well fill when the parent already paints the same colour and radius
 *   radius         well radius override (defaults: card 10, hero 0, thumb 10)
 *   priority       'low' | 'normal' | 'high' (expo-image fetch priority; hero defaults to high)
 *   dimmed         sold-out treatment (greyscale + 45% opacity)
 *   recyclingKey   pass the product id inside recycled lists
 *   onLoad         called once the image has decoded (the card → PDP hero crossfade waits for it)
 *   accessibilityLabel  set when the image is meaningful on its own; otherwise it is decorative
 */
import React, { memo, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Skeleton } from '../ui';
import { radii } from '../../constants/theme';
import { useTheme } from '../../theme';

const WEB = Platform.OS === 'web';

const VARIANTS = {
    card: { inset: '8%', radius: radii.well, glyph: 0.42 },
    hero: { inset: '10%', radius: 0, glyph: 0.32 },
    thumb: { inset: '8%', radius: radii.well, glyph: 0.5 },
};

const TRANSITION = { duration: 180, effect: 'cross-dissolve', timing: 'ease-out' };

/** Neutral paper shopping bag, two-tone with a folded lip, so a missing image still reads as "product". */
export const BagGlyph = memo(function BagGlyph({ size = 48 }) {
    const { colors, isDark } = useTheme();
    const body = isDark ? colors.neutral[800] : colors.neutral[200];
    const side = isDark ? colors.neutral[700] : colors.neutral[300];
    const line = colors.inkDisabled;
    return (
        <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d="M33 15 L38 18 L38 41 L33 42 Z" fill={side} />
            <Path d="M10 15 H33 V42 H10 Z" fill={body} />
            <Path d="M16.5 17 V12.5 a5 5 0 0 1 10 0 V17" fill="none" stroke={line} strokeWidth="2" strokeLinecap="round" />
        </Svg>
    );
});

function ProductImage({
    uri,
    variant = 'card',
    size,
    style,
    tint,
    radius,
    priority,
    dimmed = false,
    recyclingKey,
    accessibilityLabel,
    onLoad,
    bare = false, // parent already paints the same well colour + radius (ProductCard): skip the fill
}) {
    const v = VARIANTS[variant] || VARIANTS.card;
    const { colors } = useTheme();
    const src = typeof uri === 'string' && uri.trim() ? uri : null;
    const [status, setStatus] = useState(src ? 'loading' : 'missing');

    // Recycled rows and new uris restart the load cycle.
    useEffect(() => {
        setStatus(src ? 'loading' : 'missing');
    }, [src]);

    const r = radius ?? v.radius;
    const box = size ? { width: size, height: size } : null;
    const glyph = size ? Math.round(size * v.glyph) : variant === 'hero' ? 96 : 48;
    const failed = status === 'missing' || status === 'error';

    return (
        <View
            style={[styles.well, { borderRadius: r, backgroundColor: bare ? undefined : tint || colors.imageWell }, box, style]}
            accessible={!!accessibilityLabel}
            accessibilityRole={accessibilityLabel ? 'image' : undefined}
            accessibilityLabel={accessibilityLabel}
        >
            {src && status !== 'error' ? (
                <Image
                    source={{ uri: src }}
                    style={[styles.image, { top: v.inset, left: v.inset, right: v.inset, bottom: v.inset }, dimmed && styles.dimmed, WEB && colors.imageBlend === 'multiply' && styles.webBlend]}
                    contentFit="contain"
                    transition={TRANSITION}
                    priority={priority || (variant === 'hero' ? 'high' : 'normal')}
                    cachePolicy="memory-disk"
                    recyclingKey={recyclingKey != null ? String(recyclingKey) : undefined}
                    onLoad={() => {
                        setStatus('loaded');
                        onLoad?.();
                    }}
                    onError={() => setStatus('error')}
                    accessibilityIgnoresInvertColors
                    accessible={false}
                />
            ) : null}
            {status === 'loading' ? (
                <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
                    <Skeleton width="100%" height="100%" radius={r} tint={tint || colors.imageWell} />
                </View>
            ) : null}
            {failed ? (
                <View style={[styles.center, dimmed && styles.dimmedGlyph, { pointerEvents: 'none' }]}>
                    <BagGlyph size={glyph} />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    well: {
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        // Keep the multiply blend inside the well (web): it must only see the well colour.
        ...(WEB ? { isolation: 'isolate' } : null),
    },
    image: {
        position: 'absolute',
    },
    webBlend: {
        mixBlendMode: 'multiply',
    },
    center: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dimmed: {
        opacity: 0.45,
        filter: [{ grayscale: 1 }],
    },
    dimmedGlyph: {
        opacity: 0.6,
    },
});

export default memo(ProductImage);
