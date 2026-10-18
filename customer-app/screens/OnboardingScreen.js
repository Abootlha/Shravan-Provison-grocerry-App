/**
 * OnboardingScreen — four pages on the flat auth surface (white; dark: canvas), DESIGN.md
 * "Auth/onboarding" + docs/design/onboarding-references.md:
 *   0 Welcome   real catalogue photos scattered around a centre tile that grows into a real product
 *               card (name, price, store delivery time); centred two-line headline, one line of copy,
 *               three trust facts, "Get started" and "I already have an account".
 *   1 Fresh     "Packing your order" card with three real products ticking off, over a dimmed grid of
 *               catalogue tiles.
 *   2 Track     "On the way" card: the scooter tilts with the drag, the rider slides along the route,
 *               arrival time from the store settings.
 *   3 Location  primer (store ⟷ home, two ticked benefits) → OS permission → map around the store with
 *               the delivery radius drawing in and the user's pin dropping → honest verdict. The point is
 *               saved to Redux (locationSlice). "Enter address manually" opens the Location screen and
 *               the picked address is checked when it comes back.
 * Pager: one shared `position` (UI thread). Pages follow the finger, a flick or half a page commits
 * (one page per swipe), anything less springs back; buttons spring the pager too. A segmented progress
 * bar fills with the position. Skip is always in the bar (pages 0–2 → location step, 3 → Login).
 * Motion is only on mount, drag and tap; no loops. Reduced motion: pages crossfade, nothing travels.
 * Completion writes `onboardingComplete` and replaces to Login (unchanged contract). Android back steps
 * back a page. Opened from Splash, the bar logo settles where the splash mark landed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, View, useWindowDimensions } from 'react-native';
import Animated, {
    Extrapolation,
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { durations, easings, springs } from '../theme/motion';
import { Button, ContentSwap, PressableScale, Screen, Text, haptic } from '../components/ui';
import { useTranslation } from '../hooks/useTranslation';
import { useStoreStatus } from '../hooks/useStoreSettings';
import { AuthBar } from './auth/AuthHero';
import { useFromSplashHandoff } from './auth/authMotion';
import { onboardingCopy } from './onboarding/copy';
import { useCatalogPreview } from './onboarding/useCatalogPreview';
import { WelcomeHero, WELCOME_TILE_COUNT } from './onboarding/WelcomeHero';
import { PackingCard, RideCard, StepCard } from './onboarding/StepCards';
import { DimmedGrid, GRID_TILES, SegmentedProgress } from './onboarding/PagerParts';
import { LocationStep } from './onboarding/LocationStep';
import { useDeliveryLocation } from './onboarding/useDeliveryLocation';

const PAGES = 4;
const LAST = PAGES - 1;
const GRID_OFFSET = WELCOME_TILE_COUNT + 1; // the grid behind the cards uses the next tiles
const TILE_COUNT = GRID_OFFSET + GRID_TILES;
const PAGER_SPRING = { damping: 26, stiffness: 220, mass: 0.9 };

/** One pager page: follows `position` (or crossfades under reduced motion). */
function Page({ i, position, width, active, children }) {
    const reduce = useReducedMotion();
    const style = useAnimatedStyle(() => {
        const d = i - position.value;
        if (reduce) return { opacity: interpolate(Math.abs(d), [0, 1], [1, 0], Extrapolation.CLAMP) };
        return { transform: [{ translateX: d * width }] };
    });
    return (
        <Animated.View
            style={[pageStyle, style, { pointerEvents: active ? 'auto' : 'none' }]}
            accessibilityElementsHidden={!active}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        >
            {children}
        </Animated.View>
    );
}
const pageStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

/** Headline block: lags the page (0.6x) and fades as it leaves. */
function PageCopy({ i, position, width, title, body, children }) {
    const styles = useStyles();
    const reduce = useReducedMotion();
    const style = useAnimatedStyle(() => {
        const d = position.value - i;
        if (reduce) return {};
        return {
            opacity: interpolate(Math.abs(d), [0, 0.8], [1, 0], Extrapolation.CLAMP),
            transform: [{ translateX: d * width * 0.4 }],
        };
    });
    return (
        <Animated.View style={[styles.copy, style]}>
            <Text variant="display" align="center" accessibilityRole="header">{title}</Text>
            {body ? <Text variant="body" color="secondary" align="center" style={styles.body}>{body}</Text> : null}
            {children}
        </Animated.View>
    );
}

function Fact({ icon, label }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.fact}>
            <MaterialCommunityIcons name={icon} size={20} color={colors.inkSecondary} />
            <Text variant="caption" color="secondary" align="center" numberOfLines={2}>{label}</Text>
        </View>
    );
}

const OnboardingScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const { isDark } = useTheme();
    const logoStyle = useFromSplashHandoff(route, navigation);
    const { isHi } = useTranslation();
    const copy = onboardingCopy(isHi);
    const reduce = useReducedMotion();
    const { width } = useWindowDimensions();
    const { settings, etaMinutes } = useStoreStatus();
    const preview = useCatalogPreview(TILE_COUNT);
    const loc = useDeliveryLocation({ isHi });
    const selectedAddress = useSelector((s) => s.location?.selectedAddress);

    const [index, setIndex] = useState(0);
    const indexRef = useRef(0);
    const position = useSharedValue(0);
    const dragStart = useSharedValue(0);

    // the welcome card shows a product that isn't already in the scatter
    const featured = preview.products[WELCOME_TILE_COUNT] || preview.products[0] || null;
    const packing = preview.products.slice(TILE_COUNT).length >= 3 ? preview.products.slice(TILE_COUNT) : preview.products.slice(3);

    const settle = useCallback((i) => {
        if (i === indexRef.current) return;
        indexRef.current = i;
        setIndex(i);
        haptic('selection');
    }, []);

    const goTo = useCallback(
        (i) => {
            const next = Math.max(0, Math.min(LAST, i));
            cancelAnimation(position);
            position.value = reduce
                ? withTiming(next, { duration: durations.base, easing: easings.out })
                : withSpring(next, PAGER_SPRING);
            settle(next);
        },
        [position, reduce, settle],
    );

    const finish = useCallback(async () => {
        try {
            await AsyncStorage.setItem('onboardingComplete', 'true');
        } catch (e) {
            // Login works either way; onboarding just shows again next launch
        }
        navigation.replace('Login');
    }, [navigation]);

    // Address picked on the Location screen: check it when we come back (only after a real blur, so a
    // re-render before the push can't consume it).
    const addressAtLeave = useRef(undefined);
    const wentAway = useRef(false);
    useEffect(() => navigation.addListener('blur', () => { wentAway.current = true; }), [navigation]);
    const openManual = useCallback(() => {
        addressAtLeave.current = selectedAddress || null;
        wentAway.current = false;
        navigation.navigate('Location');
    }, [navigation, selectedAddress]);
    const { pickPlace } = loc;
    useFocusEffect(
        useCallback(() => {
            if (addressAtLeave.current === undefined || !wentAway.current) return;
            const before = addressAtLeave.current;
            addressAtLeave.current = undefined;
            wentAway.current = false;
            const picked = selectedAddress;
            if (picked && picked !== before && picked.latitude && picked.longitude) pickPlace(picked);
        }, [selectedAddress, pickPlace]),
    );

    // Android back: one page back before leaving onboarding.
    useFocusEffect(
        useCallback(() => {
            const sub = BackHandler.addEventListener('hardwareBackPress', () => {
                if (indexRef.current === 0) return false;
                goTo(indexRef.current - 1);
                return true;
            });
            return () => sub.remove();
        }, [goTo]),
    );

    useEffect(() => {
        if (loc.status === 'inArea') haptic('success');
        else if (loc.status === 'outOfArea' || loc.status === 'denied' || loc.status === 'error') haptic('light');
    }, [loc.status]);

    const pan = Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-18, 18])
        .onBegin(() => {
            cancelAnimation(position);
            dragStart.value = position.value;
        })
        .onUpdate((e) => {
            const raw = dragStart.value - e.translationX / width;
            // rubber band before the first and after the last page
            position.value = raw < 0 ? raw * 0.25 : raw > LAST ? LAST + (raw - LAST) * 0.25 : raw;
        })
        .onEnd((e) => {
            const from = Math.round(dragStart.value);
            const moved = dragStart.value - e.translationX / width - from;
            let target = from;
            if (moved > 0.5 || (e.velocityX < -500 && moved > 0.04)) target = from + 1;
            else if (moved < -0.5 || (e.velocityX > 500 && moved < -0.04)) target = from - 1;
            target = Math.max(0, Math.min(LAST, target));
            position.value = reduce
                ? withTiming(target, { duration: durations.base, easing: easings.out })
                : withSpring(target, { ...PAGER_SPRING, velocity: -e.velocityX / width });
            scheduleOnRN(settle, target);
        });

    // Footer actions per page / location state. Same height on every page, so pages never jump.
    const actions = useMemo(() => {
        const L = copy.location;
        if (index === 0) return { key: 'welcome', primary: [copy.welcome.cta, () => goTo(1)], link: [copy.welcome.haveAccount, copy.welcome.logIn, finish] };
        if (index < LAST) return { key: 'next', primary: [copy.next, () => goTo(index + 1)] };
        switch (loc.status) {
            case 'inArea':
                return { key: 'in', primary: [L.continue, finish], secondary: [L.change, openManual], note: L.reassure };
            case 'outOfArea':
                return { key: 'out', primary: [L.browse, finish], secondary: [L.tryAnother, openManual], note: L.reassure };
            case 'denied':
                return { key: 'denied', primary: [L.manual, openManual], secondary: [L.notNow, finish], note: L.reassure };
            case 'error':
                return { key: 'error', primary: [L.tryAgain, loc.locate], secondary: [L.manual, openManual], note: L.reassure };
            default:
                return { key: 'primer', primary: [L.continue, loc.locate], secondary: [L.manual, openManual], note: L.reassure };
        }
    }, [copy, index, loc.status, loc.locate, goTo, finish, openManual]);

    const skip = index < LAST ? () => goTo(LAST) : finish;

    return (
        <Screen edges={['bottom']} background={isDark ? 'canvas' : 'surface'}>
            <AuthBar
                logoStyle={logoStyle}
                right={
                    <PressableScale onPress={skip} style={styles.skip} hitSlop={8} accessibilityRole="button" accessibilityLabel={copy.skip}>
                        <Text variant="label" color="secondary">{copy.skip}</Text>
                    </PressableScale>
                }
            />
            <SegmentedProgress position={position} count={LAST} label={copy.step(Math.max(1, index), LAST)} />

            <GestureDetector gesture={pan}>
                <View style={styles.pager}>
                    <DimmedGrid position={position} width={width} tiles={preview.tiles} offset={GRID_OFFSET} />

                    <Page i={0} position={position} width={width} active={index === 0}>
                        <WelcomeHero
                            position={position}
                            width={width}
                            tiles={preview.tiles}
                            product={featured}
                            etaMinutes={etaMinutes}
                            isHi={isHi}
                        />
                        <PageCopy i={0} position={position} width={width} title={copy.welcome.title} body={copy.welcome.body}>
                            <View style={styles.facts}>
                                <Fact icon="clock-outline" label={etaMinutes ? copy.welcome.etaFact(etaMinutes) : copy.welcome.etaFactUnknown} />
                                <View style={styles.factRule} />
                                <Fact icon="moped" label={copy.welcome.trackFact} />
                                <View style={styles.factRule} />
                                <Fact icon="wallet-outline" label={copy.welcome.payFact} />
                            </View>
                        </PageCopy>
                    </Page>

                    <Page i={1} position={position} width={width} active={index === 1}>
                        <View style={styles.stage}>
                            <StepCard position={position} index={1} width={width}>
                                {(entered) => (
                                    <PackingCard entered={entered} products={packing} storeName={settings?.storeName} isHi={isHi} />
                                )}
                            </StepCard>
                        </View>
                        <PageCopy i={1} position={position} width={width} title={copy.fresh.title} body={copy.fresh.body} />
                    </Page>

                    <Page i={2} position={position} width={width} active={index === 2}>
                        <View style={styles.stage}>
                            <StepCard position={position} index={2} width={width}>
                                {(entered) => (
                                    <RideCard entered={entered} position={position} index={2} etaMinutes={etaMinutes} isHi={isHi} />
                                )}
                            </StepCard>
                        </View>
                        <PageCopy i={2} position={position} width={width} title={copy.track.title} body={copy.track.body} />
                    </Page>

                    <Page i={3} position={position} width={width} active={index === 3}>
                        <LocationStep loc={loc} position={position} index={3} copy={copy.location} />
                    </Page>
                </View>
            </GestureDetector>

            <ContentSwap stateKey={actions.key} style={styles.footer}>
                <View style={styles.footerInner}>
                    <Button
                        size="lg"
                        fullWidth
                        label={actions.primary[0]}
                        onPress={actions.primary[1]}
                        loading={index === LAST && loc.status === 'locating'}
                        haptic="medium"
                    />
                    {actions.link ? (
                        // a quiet text link, not a second button: "Already have an account? Log in"
                        <PressableScale
                            onPress={actions.link[2]}
                            style={styles.link}
                            accessibilityRole="link"
                            accessibilityLabel={`${actions.link[0]} ${actions.link[1]}`}
                        >
                            <Text variant="body" color="secondary" align="center">
                                {actions.link[0]}{' '}
                                <Text variant="bodyStrong" color="brand">{actions.link[1]}</Text>
                            </Text>
                        </PressableScale>
                    ) : actions.secondary ? (
                        <Button variant="ghost" size="md" fullWidth label={actions.secondary[0]} onPress={actions.secondary[1]} />
                    ) : (
                        <View style={styles.secondarySlot} />
                    )}
                    <Text variant="caption" color="muted" align="center" style={styles.note}>
                        {actions.note || ''}
                    </Text>
                </View>
            </ContentSwap>
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    pager: { flex: 1, overflow: 'hidden' },
    stage: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.xl, paddingBottom: space.lg },
    copy: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md, gap: space.sm, alignItems: 'center' },
    body: { maxWidth: 340 },
    facts: { flexDirection: 'row', alignSelf: 'stretch', alignItems: 'flex-start', marginTop: space.lg },
    fact: { flex: 1, alignItems: 'center', gap: space.xs + 2, paddingHorizontal: space.xs },
    factRule: { width: 1, alignSelf: 'stretch', marginVertical: space.xs, backgroundColor: t.colors.hairline },
    link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: space.sm },
    footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
    footerInner: { gap: space.xs },
    secondarySlot: { height: 48 },
    note: { minHeight: 32, paddingHorizontal: space.lg },
}));

export default OnboardingScreen;
