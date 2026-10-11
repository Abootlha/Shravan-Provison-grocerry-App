/**
 * BannerCarousel — the single hero carousel (r12, 16pt gutters). Each slide is a FLAT block
 * (DESIGN.md "Banners"): warm neutral, or brand violet for at most one slide, with real pack-shot
 * cut-outs on the right (transparent art, so the block colour follows the theme) and the copy
 * rendered in-app on the flat left side — translatable, themable, no scrim needed.
 *
 * - Auto-advances; the active progress segment fills over `autoPlayInterval`, and the slide
 *   advances when it completes (one clock for both, so they never drift).
 * - Touching the carousel pauses the clock; releasing resumes from where it stopped. The clock also
 *   pauses while the screen is not focused (another tab or a pushed screen), so a hidden Home never
 *   keeps the UI thread animating.
 * - A flick or a drag past 25% snaps to the neighbour with a spring; otherwise it springs back.
 * - Reduced motion: no auto-advance, slides switch without travel, no parallax.
 * - Parallax (UI thread, transform only): the art is over-scaled 1.12× inside each slide so it can
 *   move without exposing an edge.
 *     · vertical: pass the screen's scroll offset as `scrollY` (a SharedValue) — the art drifts at
 *       0.15× scroll and the copy at 0.05×, so the image reads as deeper than the text (clamped to
 *       the over-scale margin; pull-down overscroll works too).
 *     · horizontal: while panning, each slide's art moves 10% of its offset from centre ahead of
 *       the track (art faster than the frame), copy 4% behind it.
 * - No scrollToIndex anywhere (the old FlatList version threw when items weren't measured).
 * - Copy is capped to the left ~44% of the slide (the art leaves that side empty) and steps down a
 *   size on narrow slides (< 340pt) so it never runs into the product art at 360pt-wide phones.
 *
 * Props
 *   banners           [{ id, image (require() or uri; transparent art, products on the right),
 *                       title?, subtitle?, surface?: 'neutral' | 'brand', accessibilityLabel? }]
 *   onPress           (banner, index) => void
 *   autoPlayInterval  ms (default 4500)
 *   width             slide width (default: window width - 2 * gutter)
 *   aspectRatio       width / height (default 16 / 9)
 *   scrollY           optional Reanimated SharedValue<number> — the parent list's vertical scroll offset
 *   style
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
    cancelAnimation,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { PressableScale, Text } from './ui';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { springs, easings, press, signature } from '../theme/motion';

const SEGMENT_W = 18;
const ACTIVE_STRETCH = 1.6; // the active segment is longer so the eye finds it

const Segment = memo(({ i, active, progress }) => {
    const styles = useStyles();
    const fill = useAnimatedStyle(() => {
        const p = i === active ? progress.value : 0;
        return { transform: [{ translateX: (p - 1) * SEGMENT_W * ACTIVE_STRETCH }] };
    }, [i, active]);
    return (
        <View style={[styles.segment, i === active && styles.segmentActive]}>
            <Animated.View style={[styles.segmentFill, fill]} />
        </View>
    );
});

const PX = signature.parallax;
const ART_SCALE = PX.overscale; // over-scale so parallax never exposes an edge
const ART_Y = PX.art; // art: 0.15 × scroll
const COPY_Y = PX.copy; // copy: 0.05 × scroll
const ART_X = PX.artPan; // art leads the track by 10% of the slide's offset
const COPY_X = PX.copyPan; // copy trails slightly

const NARROW = 340; // slide width below which side copy steps down a size
const SIDE_COPY = 0.44; // copy never crosses this fraction of the slide width
// The banner block: a warm grey one step deeper than the canvas so the block reads as a surface
// (DESIGN.md "Banners"). Dark: the raised layer. Brand slides use the brand fill in both themes.
const BANNER_NEUTRAL_LIGHT = '#EDEDEA';

const Slide = memo(({ banner, index, width, height, onPress, x, scrollY, parallax }) => {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
        // Margins the over-scaled art can travel inside the slide.
    const marginX = (width * (ART_SCALE - 1)) / 2;
    const marginY = (height * (ART_SCALE - 1)) / 2;
    const artStyle = useAnimatedStyle(() => {
        if (!parallax) return { transform: [{ scale: ART_SCALE }] };
        const rel = x.value + index * width; // 0 when this slide is centred
        const tx = Math.max(-marginX, Math.min(marginX, rel * ART_X));
        const sy = scrollY ? scrollY.value : 0;
        const ty = Math.max(-marginY, Math.min(marginY, sy * ART_Y));
        return { transform: [{ translateX: tx }, { translateY: ty }, { scale: ART_SCALE }] };
    }, [parallax, index, width, marginX, marginY]);
    const copyStyle = useAnimatedStyle(() => {
        if (!parallax) return {};
        const rel = x.value + index * width;
        const sy = scrollY ? scrollY.value : 0;
        return {
            transform: [
                { translateX: interpolate(rel, [-width, width], [-width * COPY_X, width * COPY_X], 'clamp') },
                { translateY: Math.max(-12, Math.min(12, sy * COPY_Y)) },
            ],
        };
    }, [parallax, index, width]);
    const brand = banner.surface === 'brand';
    const blockColor = brand ? colors.brand : isDark ? colors.surfaceRaised : BANNER_NEUTRAL_LIGHT;
    const textColor = brand ? colors.onBrand : colors.ink;
    const narrow = width < NARROW;
    const handlePress = useCallback(() => onPress && onPress(banner, index), [onPress, banner, index]);
    return (
        <PressableScale
            onPress={handlePress}
            scaleTo={press.subtle}
            accessibilityLabel={banner.accessibilityLabel || banner.title}
            style={[styles.slide, { width, height, backgroundColor: blockColor }]}
        >
            <Animated.View style={[styles.image, artStyle]}>
                <Image source={banner.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
            </Animated.View>
            {banner.title ? (
                <Animated.View
                    style={[
                        styles.copy,
                        { width: Math.round(width * SIDE_COPY) - space.lg },
                        copyStyle, { pointerEvents: 'none' }]}
                >
                    <Text variant="h2" color={textColor} numberOfLines={3} style={narrow && styles.titleNarrow}>
                        {banner.title}
                    </Text>
                    {banner.subtitle ? (
                        <Text
                            variant={narrow ? 'caption' : 'label'}
                            weight="medium"
                            color={textColor}
                            numberOfLines={2}
                            style={styles.subtitle}
                        >
                            {banner.subtitle}
                        </Text>
                    ) : null}
                </Animated.View>
            ) : null}
        </PressableScale>
    );
});

const BannerCarousel = ({ banners = [], onPress, autoPlayInterval = 4500, width: widthProp, aspectRatio = 16 / 9, scrollY, style }) => {
    const styles = useStyles();
    const { width: windowWidth } = useWindowDimensions();
    const width = widthProp || windowWidth - space.gutter * 2;
    const height = Math.round(width / aspectRatio);
    const count = banners.length;
    const reduce = useReducedMotion();

    const [active, setActive] = useState(0);
    const activeRef = useRef(0);
    const x = useSharedValue(0); // track offset
    const start = useSharedValue(0);
    const progress = useSharedValue(0);
    const auto = count > 1 && !reduce;

    const goTo = useCallback(
        (next) => {
            const i = ((next % count) + count) % count;
            activeRef.current = i;
            setActive(i);
            x.value = reduce ? withTiming(-i * width, { duration: 0 }) : withSpring(-i * width, springs.drag);
        },
        [count, width, reduce],
    );

    // One clock: fill the active segment, then advance. The worklet calls a stable
    // trampoline so a re-render (e.g. width change) never leaves it holding a stale closure.
    const advanceRef = useRef(null);
    const callAdvance = useCallback(() => advanceRef.current && advanceRef.current(), []);
    const runClock = useCallback(
        (from = 0) => {
            if (!auto) return;
            progress.value = from;
            progress.value = withTiming(1, { duration: autoPlayInterval * (1 - from), easing: easings.linear }, (done) => {
                if (done) runOnJS(callAdvance)();
            });
        },
        [auto, autoPlayInterval, callAdvance],
    );
    advanceRef.current = () => {
        goTo(activeRef.current + 1);
        runClock(0);
    };

    useEffect(() => {
        x.value = -activeRef.current * width;
    }, [width]);

    useEffect(() => {
        runClock(0);
        return () => cancelAnimation(progress);
    }, [runClock]);

    const pause = useCallback(() => cancelAnimation(progress), []);
    const resume = useCallback((changed) => runClock(changed ? 0 : Math.min(progress.value, 0.98)), [runClock]);

    // Hold the clock while the screen is hidden (tabs and stack screens stay mounted underneath).
    const focused = useIsFocused();
    const wasFocused = useRef(focused);
    useEffect(() => {
        if (wasFocused.current === focused) return;
        wasFocused.current = focused;
        if (focused) resume(false);
        else pause();
    }, [focused, pause, resume]);

    const settle = useCallback(
        (target, changed) => {
            goTo(target);
            resume(changed);
        },
        [goTo, resume],
    );

    const pan = Gesture.Pan()
        .enabled(count > 1)
        .activeOffsetX([-12, 12])
        .failOffsetY([-10, 10])
        .onBegin(() => {
            cancelAnimation(x);
            start.value = x.value;
            runOnJS(pause)();
        })
        .onUpdate((e) => {
            let next = start.value + e.translationX;
            const min = -(count - 1) * width;
            // rubber-band past the ends
            if (next > 0) next = next * 0.35;
            if (next < min) next = min + (next - min) * 0.35;
            x.value = next;
        })
        .onEnd((e) => {
            const current = Math.round(-start.value / width);
            let target = current;
            if (e.translationX < -width * 0.25 || e.velocityX < -500) target = current + 1;
            else if (e.translationX > width * 0.25 || e.velocityX > 500) target = current - 1;
            target = Math.max(0, Math.min(count - 1, target));
            runOnJS(settle)(target, target !== current);
        })
        .onFinalize((_e, success) => {
            if (!success) runOnJS(resume)(false);
        });

    const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

    if (!count) return null;

    return (
        <View style={[styles.root, style]}>
            <GestureDetector gesture={pan}>
                <View
                    style={[styles.viewport, { width, height }]}
                    accessibilityRole="adjustable"
                    accessibilityLabel={banners[active]?.accessibilityLabel || banners[active]?.title || 'Offers'}
                    accessibilityValue={{ text: `${active + 1} of ${count}` }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={(e) => {
                        if (e.nativeEvent.actionName === 'increment') settle(Math.min(count - 1, active + 1), true);
                        if (e.nativeEvent.actionName === 'decrement') settle(Math.max(0, active - 1), true);
                    }}
                >
                    <Animated.View style={[styles.track, { width: width * count }, trackStyle]}>
                        {banners.map((b, i) => (
                            <Slide key={b.id || i} banner={b} index={i} width={width} height={height} onPress={onPress} x={x} scrollY={scrollY} parallax={!reduce} />
                        ))}
                    </Animated.View>
                </View>
            </GestureDetector>
            {count > 1 ? (
                <View style={[styles.dots, { pointerEvents: 'none' }]}>
                    {banners.map((b, i) => (
                        <Segment key={b.id || i} i={i} active={active} progress={progress} />
                    ))}
                </View>
            ) : null}
        </View>
    );
};

const useStyles = makeStyles((t) => ({
    root: { alignItems: 'center' },
    viewport: { borderRadius: radii.card, overflow: 'hidden', backgroundColor: t.colors.surfaceSunken },
    track: { flexDirection: 'row', height: '100%' },
    slide: { overflow: 'hidden', backgroundColor: t.colors.surfaceSunken },
    image: { ...StyleSheet.absoluteFill },
    copy: { position: 'absolute', left: space.lg, top: 0, bottom: 0, justifyContent: 'center' },
    titleNarrow: { fontSize: 18, lineHeight: 23 },
    subtitle: { marginTop: space.xs },
    dots: { flexDirection: 'row', gap: space.xs + space.xxs, marginTop: space.md },
    segment: {
        width: SEGMENT_W,
        height: 4,
        borderRadius: radii.pill,
        backgroundColor: t.colors.border,
        overflow: 'hidden',
    },
    segmentActive: { width: SEGMENT_W * ACTIVE_STRETCH },
    segmentFill: { ...StyleSheet.absoluteFill, backgroundColor: t.isDark ? t.colors.brandText : t.colors.brand, borderRadius: radii.pill },
}));

export default memo(BannerCarousel);
