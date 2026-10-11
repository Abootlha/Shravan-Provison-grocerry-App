/**
 * ImageViewer — Zomato-style full-screen image viewer.
 * Swipe horizontally between images; drag down (or flick) to dismiss — the backdrop fades
 * with the drag and a short release springs back. A close button is the tap alternative.
 *
 * Props: visible, images[], initialIndex, onClose, productName
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { IconButton, Text } from '../ui';
import { radii, space } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { springs, durations, easings } from '../../theme/motion';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

export default function ImageViewer({ visible, images = [], initialIndex = 0, onClose, productName = 'Product' }) {
    const styles = useStyles();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const reduce = useReducedMotion();
    const [index, setIndex] = useState(initialIndex);
    const ty = useSharedValue(0);
    const open = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setIndex(initialIndex);
            ty.value = 0;
            open.value = reduce ? withTiming(1, { duration: durations.base }) : withSpring(1, springs.sheet);
        }
    }, [visible, initialIndex, reduce]);

    const finish = useCallback(() => onClose?.(), [onClose]);

    const close = useCallback(() => {
        open.value = withTiming(0, { duration: durations.base, easing: easings.out }, (done) => {
            if (done) scheduleOnRN(finish);
        });
    }, [finish]);

    const pan = Gesture.Pan()
        .activeOffsetY([-14, 14])
        .failOffsetX([-14, 14])
        .onUpdate((e) => {
            ty.value = e.translationY;
        })
        .onEnd((e) => {
            if (Math.abs(e.translationY) > DISMISS_DISTANCE || Math.abs(e.velocityY) > DISMISS_VELOCITY) {
                const dir = e.translationY >= 0 ? 1 : -1;
                ty.value = withTiming(dir * height * 0.6, { duration: durations.base, easing: easings.out });
                open.value = withTiming(0, { duration: durations.base, easing: easings.out }, (done) => {
                    if (done) scheduleOnRN(finish);
                });
            } else {
                ty.value = withSpring(0, springs.drag);
            }
        });

    const backdrop = useAnimatedStyle(() => ({
        opacity: open.value * interpolate(Math.abs(ty.value), [0, 400], [1, 0.25], 'clamp'),
    }));
    const content = useAnimatedStyle(() => ({
        opacity: open.value,
        transform: reduce
            ? []
            : [
                  { translateY: ty.value },
                  { scale: interpolate(open.value, [0, 1], [0.94, 1]) * interpolate(Math.abs(ty.value), [0, 400], [1, 0.86], 'clamp') },
              ],
    }));
    const chrome = useAnimatedStyle(() => ({
        opacity: open.value * interpolate(Math.abs(ty.value), [0, 80], [1, 0], 'clamp'),
    }));

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
            <GestureHandlerRootView style={styles.root}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
                <GestureDetector gesture={pan}>
                    <Animated.View style={[styles.root, content]}>
                        <FlatList
                            data={images}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            initialScrollIndex={Math.min(initialIndex, Math.max(images.length - 1, 0))}
                            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                            keyExtractor={(item, i) => `${i}-${item}`}
                            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
                            renderItem={({ item, index: i }) => (
                                <View style={{ width, height }}>
                                    <Image
                                        source={{ uri: item }}
                                        style={styles.image}
                                        contentFit="contain"
                                        transition={150}
                                        accessibilityLabel={`${productName}, image ${i + 1} of ${images.length}`}
                                    />
                                </View>
                            )}
                        />
                    </Animated.View>
                </GestureDetector>
                <Animated.View style={[styles.top, { paddingTop: insets.top + space.sm }, chrome, { pointerEvents: 'box-none' }]}>
                    <IconButton name="close" variant="scrim" onPress={close} accessibilityLabel="Close image viewer" />
                    {images.length > 1 ? (
                        <View style={styles.counter}>
                            <Text variant="label" color="onNight">
                                {index + 1} / {images.length}
                            </Text>
                        </View>
                    ) : null}
                </Animated.View>
                <Animated.View style={[styles.hint, { bottom: insets.bottom + space.xl }, chrome, { pointerEvents: 'none' }]}>
                    <Text variant="caption" color="onNight" align="center">
                        Swipe down to close
                    </Text>
                </Animated.View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const useStyles = makeStyles((t) => ({
    root: { flex: 1 },
    // A photo viewer is always night, in both themes (surfaceInverse flips to near-white in dark).
    backdrop: { backgroundColor: t.isDark ? t.colors.night[950] : t.colors.surfaceInverse },
    image: { flex: 1, marginHorizontal: space.lg },
    top: {
        position: 'absolute',
        top: 0,
        left: space.lg,
        right: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    counter: {
        backgroundColor: t.colors.onImageScrim,
        borderRadius: radii.pill,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
    },
    hint: { position: 'absolute', left: 0, right: 0 },
}));
