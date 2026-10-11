/**
 * ImageGallery — PDP hero: full-bleed image well with the packshot large and centred, paged.
 * Tapping an image calls onOpen(index) (full-screen viewer). Fixed height, so it can
 * never collapse to 0px.
 *
 * Theme: the page paints one flat image well (colors.imageWell, or `tint`) behind every page; the
 * image boxes stay transparent so there is no square seam around the pack shot. No well light.
 *
 * Motion (UI thread, scroll-linked so it follows the finger and the native paging spring exactly)
 *   pages      the pack shot eases back (0.9 scale, 0.55 opacity) and lags 18% as it leaves centre
 *   dots       a "worm" indicator: quiet dots + one brand pill that slides with the pager and
 *              stretches across the gap mid-swipe, settling back to a short pill on the page
 *
 * Hero hook-up (card → PDP shared element): the first image is wrapped in an Animated.View that
 * takes `heroRef`, `heroStyle` (hidden while the overlay owns it) and `onHeroLayout`; `onHeroLoad`
 * fires when it decodes. All optional.
 */
import React, { memo, useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import ProductImage from './ProductImage';
import { space } from '../../constants/theme';
import { useTheme, makeStyles } from '../../theme';

const DOT = 6;
const DOT_GAP = space.md; // 12
const REST = 2.4; // the active dot at rest is a short pill (scaleX)
const STRIDE = DOT + DOT_GAP;

/** The sliding, stretching active indicator. */
function Worm({ x, width, count }) {
    const styles = useStyles();
    const style = useAnimatedStyle(() => {
        const p = width > 0 ? Math.min(Math.max(x.value / width, 0), count - 1) : 0;
        const frac = p - Math.floor(p);
        return {
            transform: [{ translateX: p * STRIDE }, { scaleX: REST + 1.8 * Math.sin(frac * Math.PI) }],
        };
    });
    return <Animated.View style={[styles.dot, styles.worm, style]} />;
}

/** One page's pack shot, eased back as it leaves the centre. */
function Page({ index, x, width, reduce, children }) {
    const style = useAnimatedStyle(() => {
        if (reduce || !width) return {};
        const d = x.value / width - index; // -1 … 0 … 1
        const a = Math.min(Math.abs(d), 1);
        return {
            opacity: interpolate(a, [0, 1], [1, 0.55]),
            transform: [{ translateX: d * width * 0.18 }, { scale: interpolate(a, [0, 1], [1, 0.9]) }],
        };
    });
    return <Animated.View style={style}>{children}</Animated.View>;
}

function ImageGallery({ images, height, tint, onOpen, onIndexChange, productName = 'Product', heroRef, heroStyle, onHeroLayout, onHeroLoad }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    // The page paints the well; the image boxes stay transparent so there is no square seam.
    const imageTint = 'transparent';
    const [width, setWidth] = useState(0);
    const x = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((e) => {
        x.value = e.contentOffset.x;
    });

    const onMomentumEnd = useCallback(
        (e) => {
            if (!width) return;
            onIndexChange?.(Math.round(e.nativeEvent.contentOffset.x / width));
        },
        [width, onIndexChange]
    );

    const renderItem = useCallback(
        ({ item, index }) => (
            <Pressable
                onPress={() => onOpen?.(index)}
                style={[styles.page, { width, height }]}
                accessibilityRole="imagebutton"
                accessibilityLabel={`${productName}, image ${index + 1} of ${images.length}. Opens full screen`}
            >
                <Page index={index} x={x} width={width} reduce={reduce}>
                    {index === 0 ? (
                        <Animated.View ref={heroRef} collapsable={false} onLayout={onHeroLayout} style={heroStyle}>
                            <ProductImage uri={item} variant="hero" size={Math.min(width * 0.86, height - space['5xl'] - space['4xl'])} tint={imageTint} radius={0} priority="high" onLoad={onHeroLoad} />
                        </Animated.View>
                    ) : (
                        <ProductImage uri={item} variant="hero" size={Math.min(width * 0.86, height - space['5xl'] - space['4xl'])} tint={imageTint} radius={0} priority="normal" />
                    )}
                </Page>
            </Pressable>
        ),
        [width, height, imageTint, onOpen, images.length, productName, heroRef, heroStyle, onHeroLayout, onHeroLoad, x, reduce, styles]
    );

    return (
        <View style={[styles.wrap, { height, backgroundColor: tint || colors.imageWell }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
            {images.length === 0 ? (
                <View style={styles.empty}>
                    <ProductImage uri={null} variant="hero" size={Math.min(width || 240, height) * 0.7} tint={imageTint} radius={0} />
                </View>
            ) : width > 0 ? (
                <Animated.FlatList
                    data={images}
                    keyExtractor={(item, i) => `${i}-${item}`}
                    renderItem={renderItem}
                    horizontal
                    pagingEnabled
                    bounces={false}
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={onMomentumEnd}
                    getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                />
            ) : null}
            {images.length > 1 ? (
                <View style={[styles.dots, { pointerEvents: 'none' }]}>
                    <View style={styles.dotRow}>
                        {images.map((_, i) => (
                            <View key={i} style={[styles.dot, styles.dotIdle]} />
                        ))}
                        <Worm x={x} width={width} count={images.length} />
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    wrap: {
        width: '100%',
        overflow: 'hidden',
    },
    page: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: space['5xl'],
        paddingBottom: space['4xl'],
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dots: {
        position: 'absolute',
        bottom: space['3xl'] + space.sm,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    dotRow: { flexDirection: 'row', gap: DOT_GAP },
    dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
    dotIdle: { backgroundColor: t.colors.brandText, opacity: 0.35 },
    worm: { position: 'absolute', left: 0, top: 0, backgroundColor: t.colors.brandText },
}));

export default memo(ImageGallery);
