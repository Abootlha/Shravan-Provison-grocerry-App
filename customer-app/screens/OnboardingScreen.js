/**
 * OnboardingScreen — three plain slides on the flat auth surface (white; dark: canvas), DESIGN.md
 * "Auth/onboarding": the AuthBar logo with Skip, a still life of real produce in a neutral image well
 * (assets/onboarding/*.webp — composited from unbranded produce cut-outs), one plain headline, one
 * honest line of copy, a page indicator and the violet Next / Start shopping button.
 *   · No auto-advance, no timers, no mascot, no sticker clusters, no gradients, no loops.
 *   · Swipe left / right to move between slides: the slide follows the finger, a flick or a 25% drag
 *     commits, anything less springs back. A new slide enters from the side it came from.
 *   · Opened from Splash, the bar logo settles in where the splash mark landed (shared position).
 * Reduced motion: no swipe travel; the button moves on.
 * Completion writes `onboardingComplete` and replaces to Login (unchanged).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { durations, easings, springs } from '../theme/motion';
import { Button, PressableScale, Screen, Text } from '../components/ui';
import { useTranslation } from '../hooks/useTranslation';
import { AuthBar } from './auth/AuthHero';
import { useFromSplashHandoff } from './auth/authMotion';

const ENTER_FRACTION = 0.3; // a new slide enters from 30% of the width

const SLIDES = [
    {
        key: 'kirana',
        art: require('../assets/onboarding/daily-vegetables.webp'),
        en: {
            title: 'Your neighbourhood kirana, on your phone',
            body: 'Vegetables, fruit, dairy and daily staples from a store near you.',
        },
        hi: {
            title: 'आपकी मोहल्ले की किराना दुकान, अब फ़ोन पर',
            body: 'पास की दुकान से सब्ज़ियाँ, फल, डेयरी और रोज़ का सामान।',
        },
    },
    {
        key: 'fast',
        art: require('../assets/onboarding/fruit-and-eggs.webp'),
        en: {
            title: 'At your door in about 10 minutes',
            body: 'We start packing as soon as you order, and you can follow the rider live on the map.',
        },
        hi: {
            title: 'लगभग 10 मिनट में आपके दरवाज़े पर',
            body: 'ऑर्डर करते ही हम पैक करना शुरू कर देते हैं, और आप राइडर को मैप पर लाइव देख सकते हैं।',
        },
    },
    {
        key: 'pay',
        art: require('../assets/onboarding/kitchen-basics.webp'),
        en: {
            title: 'Pay online or when it arrives',
            body: 'Use UPI or a card at checkout, or pay cash at your door.',
        },
        hi: {
            title: 'ऑनलाइन या डिलीवरी पर भुगतान',
            body: 'चेकआउट पर UPI या कार्ड से भुगतान करें, या ऑर्डर आने पर कैश दें।',
        },
    },
];

/** One slide. `drag` is the live finger offset (px); `from` (-1 | 0 | 1) is the side it enters from. */
function Slide({ slide, isHi, drag, from, width, index, gone }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const enter = useSharedValue(reduce ? 0 : from * width * ENTER_FRACTION);
    const fade = useSharedValue(from ? 0 : 1);
    useEffect(() => {
        if (!from) return;
        if (!reduce) enter.value = withSpring(0, springs.gentle);
        fade.value = withTiming(1, { duration: durations.base, easing: easings.out });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // `gone` hides this slide the frame a committed swipe hands over, so it never snaps back.
    const style = useAnimatedStyle(() => {
        const x = enter.value + drag.value;
        const hide = gone.value === index ? 0 : 1;
        return { opacity: hide * fade.value * (1 - Math.min(0.6, Math.abs(x) / width)), transform: [{ translateX: x }] };
    });
    const copy = isHi ? slide.hi : slide.en;
    return (
        <Animated.View style={[styles.slide, style]}>
            <View style={styles.well}>
                <Image source={slide.art} style={styles.art} contentFit="contain" accessible={false} transition={0} />
            </View>
            <View style={styles.copy}>
                <Text variant="display" accessibilityRole="header">{copy.title}</Text>
                <Text variant="body" color="secondary" style={styles.desc}>{copy.body}</Text>
            </View>
        </Animated.View>
    );
}

function Dots({ count, index }) {
    const styles = useStyles();
    return (
        <View style={styles.dots} accessibilityLabel={`${index + 1} / ${count}`}>
            {Array.from({ length: count }, (_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
        </View>
    );
}

const OnboardingScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const { isDark } = useTheme();
    const logoStyle = useFromSplashHandoff(route, navigation);
    const { t, isHi } = useTranslation();
    const reduce = useReducedMotion();
    const { width } = useWindowDimensions();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [enterFrom, setEnterFrom] = useState(0);
    const drag = useSharedValue(0);
    const gone = useSharedValue(-1);
    const isLast = currentIndex === SLIDES.length - 1;

    const completeOnboarding = async () => {
        try {
            await AsyncStorage.setItem('onboardingComplete', 'true');
            navigation.replace('Login');
        } catch (error) {
            navigation.replace('Login');
        }
    };

    const goTo = useCallback((i) => {
        setCurrentIndex((cur) => {
            const next = Math.max(0, Math.min(SLIDES.length - 1, i));
            if (next !== cur) setEnterFrom(next > cur ? 1 : -1);
            return next;
        });
    }, []);

    useEffect(() => {
        drag.value = 0;
        gone.value = -1;
    }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    const commitSwipe = (dir) => goTo(currentIndex + dir);
    const leaving = currentIndex;
    const atStart = currentIndex === 0;
    const atEnd = isLast;
    const pan = Gesture.Pan()
        .enabled(!reduce)
        .activeOffsetX([-12, 12])
        .failOffsetY([-18, 18])
        .onUpdate((e) => {
            const dx = e.translationX;
            // rubber-band past the first / last slide
            drag.value = (dx > 0 && atStart) || (dx < 0 && atEnd) ? dx * 0.25 : dx;
        })
        .onEnd((e) => {
            const dx = e.translationX;
            const dir = dx < 0 ? 1 : -1;
            const blocked = (dir === 1 && atEnd) || (dir === -1 && atStart);
            const commit = !blocked && (Math.abs(dx) > width * 0.25 || Math.abs(e.velocityX) > 600);
            if (commit) {
                drag.value = withTiming(-dir * width * 0.5, { duration: durations.fast, easing: easings.out }, (done) => {
                    if (!done) return;
                    gone.value = leaving;
                    drag.value = 0;
                    scheduleOnRN(commitSwipe, dir);
                });
            } else {
                drag.value = withSpring(0, springs.drag);
            }
        });

    const handleNext = async () => {
        if (!isLast) goTo(currentIndex + 1);
        else await completeOnboarding();
    };

    const slide = SLIDES[currentIndex];

    return (
        <Screen edges={['bottom']} background={isDark ? 'canvas' : 'surface'}>
            <AuthBar
                logoStyle={logoStyle}
                right={
                    isLast ? null : (
                        <PressableScale onPress={completeOnboarding} style={styles.skip} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('skip')}>
                            <Text variant="label" color="secondary">{t('skip')}</Text>
                        </PressableScale>
                    )
                }
            />

            <GestureDetector gesture={pan}>
                <View style={styles.stage}>
                    <Slide key={slide.key} slide={slide} isHi={isHi} drag={drag} gone={gone} from={enterFrom} width={width} index={currentIndex} />
                </View>
            </GestureDetector>

            <View style={styles.bottom}>
                <Dots count={SLIDES.length} index={currentIndex} />
                <Button
                    size="lg"
                    fullWidth
                    label={isLast ? (isHi ? 'खरीदारी शुरू करें' : 'Start shopping') : t('next')}
                    onPress={handleNext}
                />
            </View>
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    stage: { flex: 1, overflow: 'hidden' },
    slide: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md, gap: space['2xl'] },
    well: {
        flex: 1,
        minHeight: 220,
        borderRadius: radii.card,
        backgroundColor: t.colors.imageWell,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    art: { width: '84%', height: '84%' },
    copy: { gap: space.md },
    desc: { maxWidth: 360 },
    skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: space.sm },
    bottom: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: space.sm, gap: space.lg },
    dots: { flexDirection: 'row', gap: space.xs + 2, alignSelf: 'flex-start' },
    dot: { width: 8, height: 4, borderRadius: 2, backgroundColor: t.colors.borderStrong },
    dotOn: { width: 20, backgroundColor: t.colors.brand },
}));

export default OnboardingScreen;
