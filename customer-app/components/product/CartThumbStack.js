/**
 * CartThumbStack — overlapping round thumbnails of the last 3 cart items (newest on top),
 * ringed in night so they read as cut-outs on the night cart pill (ProductImage thumb: pack shot on the well).
 * New thumbnails spring in, removed ones shrink out and the rest slide over on a spring
 * (Reanimated layout animations, UI thread).
 */
import React, { memo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, withSpring, withTiming } from 'react-native-reanimated';
import ProductImage from './ProductImage';
import { space } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { nightPillFill } from './nightPill';
import { springs, durations, easings } from '../../theme/motion';

const SIZE = 36;
const OVERLAP = 12;

const enter = () => {
    'worklet';
    return {
        initialValues: { opacity: 0, transform: [{ scale: 0.85 }] },
        animations: {
            opacity: withTiming(1, { duration: durations.fast }),
            transform: [{ scale: withSpring(1, springs.bouncy) }],
        },
    };
};

const exit = () => {
    'worklet';
    return {
        initialValues: { opacity: 1, transform: [{ scale: 1 }] },
        animations: {
            opacity: withTiming(0, { duration: durations.fast, easing: easings.out }),
            transform: [{ scale: withTiming(0.5, { duration: durations.fast, easing: easings.out }) }],
        },
    };
};

// Custom layout-animation worklets are native-only; Reanimated web supports only the presets.
const WEB = Platform.OS === 'web';
const ENTER = WEB ? FadeIn.duration(durations.fast) : enter;
const EXIT = WEB ? FadeOut.duration(durations.fast) : exit;

const layout = LinearTransition.springify().damping(springs.snappy.damping).stiffness(springs.snappy.stiffness).mass(springs.snappy.mass);

function CartThumbStack({ items }) {
    const styles = useStyles();
    const last = items.slice(-3);
    return (
        <View style={[styles.row, { width: SIZE + Math.max(0, last.length - 1) * (SIZE - OVERLAP) }]}>
            {last.map((item, i) => (
                <Animated.View
                    key={String(item.id)}
                    entering={ENTER}
                    exiting={EXIT}
                    layout={layout}
                    style={[styles.thumb, { left: i * (SIZE - OVERLAP), zIndex: i + 1 }]}
                >
                    <ProductImage uri={item.image} variant="thumb" radius={SIZE / 2} recyclingKey={item.id} style={styles.img} />
                </Animated.View>
            ))}
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    row: {
        height: SIZE,
        marginRight: space.md,
    },
    thumb: {
        position: 'absolute',
        top: 0,
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        borderWidth: 2,
        borderColor: nightPillFill(t), // the ring is the pill showing through
        backgroundColor: t.colors.imageWell,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    img: {
        ...StyleSheet.absoluteFill,
    },
}));

export default memo(CartThumbStack);
