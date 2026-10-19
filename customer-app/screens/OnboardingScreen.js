/**
 * OnboardingScreen — four pages with one layout grammar: a flat brand-violet scene panel on top (58% of
 * the screen, bottom corners 28) and left-aligned editorial type below, then one action.
 *   0 Welcome   real catalogue products drop into the panel with spring physics; drag and fling them.
 *               "Groceries in / N minutes." — N is the store's estimatedDeliveryMinutes.
 *   1 Pack      three real products drop into a Shravan bag; a receipt rolls the count and real total.
 *   2 Track     a real map around the store; the rider rides the route as you swipe.
 *   3 Location  map-first: the store's real delivery radius draws in. "Use my current location" →
 *               OS permission → the pin drops → "We deliver here · ~N min" or an honest out-of-area /
 *               denied / error state. "Enter address" opens the Location screen; the picked address is
 *               checked when the user comes back. The point is saved to Redux (locationSlice).
 * Chrome: logo top-left and Skip top-right on the panel, three thin progress segments that fill with the
 * swipe (hidden on the welcome page). Type: 44 / 17 / 15 / 13 (onboarding/type.js), Noto Sans
 * Devanagari for Hindi. Side margins 20.
 * Pager: one shared `position` on the UI thread. Scenes slide a full page, the type crossfades with a
 * small slide. A flick or half a page commits (one page per swipe); buttons spring the pager too.
 * Grabbing a welcome product blocks the pager. Motion only on mount, drag, tap and device tilt — no loops.
 * Reduced motion: pages crossfade, nothing travels or bounces.
 * Completion writes `onboardingComplete` and replaces to Login (unchanged contract). Android back steps
 * back a page. Opened from Splash, the bar logo settles in (shared hand-off).
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStyles, useTheme } from '../theme';
import { durations, easings } from '../theme/motion';
import { Button, ContentSwap, Logo, PressableScale, Screen, Text, haptic } from '../components/ui';
import { useTranslation } from '../hooks/useTranslation';
import { useStoreStatus } from '../hooks/useStoreSettings';
import { ONBOARDING_BAR, useFromSplashHandoff } from './auth/authMotion';
import { onboardingCopy, stockKinds } from './onboarding/copy';
import { useCatalogPreview } from './onboarding/useCatalogPreview';
import { useDeliveryLocation } from './onboarding/useDeliveryLocation';
import { useOnboardingType } from './onboarding/type';
import { HERO_COUNT, PackScene, RideScene, WelcomeScene } from './onboarding/Scenes';
import { DeliveryAreaMap } from './onboarding/DeliveryAreaMap';

const PAGES = 4;
const LAST = PAGES - 1;
const { SIDE, PANEL_RATIO, PANEL_RADIUS } = ONBOARDING_BAR;
const PAGER_SPRING = { damping: 26, stiffness: 220, mass: 0.9 };
const ON_BRAND = '#FFFFFF';

/** A scene inside the panel: slides a full page (crossfades under reduced motion). */
function ScenePage({ i, position, width, children }) {
    const reduce = useReducedMotion();
    const style = useAnimatedStyle(() => {
        const d = i - position.value;
        if (reduce) return { opacity: interpolate(Math.abs(d), [0, 1], [1, 0], Extrapolation.CLAMP) };
        return { transform: [{ translateX: d * width }] };
    });
    return <Animated.View style={[fill, style]}>{children}</Animated.View>;
}

/** The type below the panel: crossfades with a small slide, only the current page is interactive. */
function CopyPage({ i, position, active, children }) {
    const reduce = useReducedMotion();
    const style = useAnimatedStyle(() => {
        const d = i - position.value;
        return {
            opacity: interpolate(Math.abs(d), [0, 0.6], [1, 0], Extrapolation.CLAMP),
            transform: [{ translateX: reduce ? 0 : d * 48 }],
        };
    });
    return (
        <Animated.View
            style={[fill, pageEnd, style, { pointerEvents: active ? 'auto' : 'none' }]}
            accessibilityElementsHidden={!active}
            importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        >
            {children}
        </Animated.View>
    );
}
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
// the words sit on the action, so the breathing room is under the panel, not at the bottom
const pageEnd = { justifyContent: 'flex-end' };

function Segment({ position, i }) {
    const styles = useStyles();
    const [w, setW] = useState(0);
    const style = useAnimatedStyle(() => ({
        transform: [{ translateX: (Math.max(0, Math.min(1, position.value - i)) - 1) * w }],
    }));
    return (
        <View style={styles.segment} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
            <Animated.View style={[styles.segmentFill, style]} />
        </View>
    );
}

const OnboardingScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const { isDark } = useTheme();
    const insets = useSafeAreaInsets();
    // the Splash flies its mark straight onto this logo (and fades the panel in), so the logo itself
    // needs no settle animation — the hook only switches this screen's entrance to a short fade
    useFromSplashHandoff(route, navigation);
    const { isHi } = useTranslation();
    const copy = onboardingCopy(isHi);
    const T = useOnboardingType(isHi);
    const reduce = useReducedMotion();
    const { width, height } = useWindowDimensions();
    const { etaMinutes } = useStoreStatus();
    const preview = useCatalogPreview(HERO_COUNT);
    const loc = useDeliveryLocation({ isHi });
    const selectedAddress = useSelector((s) => s.location?.selectedAddress);

    const [index, setIndex] = useState(0);
    const indexRef = useRef(0);
    const position = useSharedValue(0);
    const dragStart = useSharedValue(0);

    const panelH = Math.round(height * PANEL_RATIO);
    const barH = insets.top + ONBOARDING_BAR.PAD_TOP + ONBOARDING_BAR.ROW + 12;
    const sceneH = panelH - barH;
    // the bag gets products the welcome panel isn't already showing, when the catalogue has enough
    const kinds = useMemo(() => stockKinds(preview.products), [preview.products]);
    const packProducts = preview.products.length >= HERO_COUNT + 3 ? preview.products.slice(HERO_COUNT) : preview.products;

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

    const pagerPan = useMemo(
        () =>
            Gesture.Pan()
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
                }),
        [width, reduce, settle, position, dragStart],
    );

    const L = copy.location;
    const actions = useMemo(() => {
        if (index === 0) return { key: 'welcome', primary: [copy.welcome.cta, () => goTo(1)], link: [copy.welcome.haveAccount, copy.welcome.logIn, finish] };
        if (index < LAST) return { key: `next${index}`, primary: [copy.next, () => goTo(index + 1)], back: [copy.back, () => goTo(index - 1)] };
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
                return { key: 'primer', primary: [L.useCurrent, loc.locate], secondary: [L.manual, openManual], note: L.reassure };
        }
    }, [copy, L, index, loc.status, loc.locate, goTo, finish, openManual]);

    // the location page's words follow the result
    const where = loc.place?.address || L.currentLabel;
    const locText = {
        inArea: [L.inAreaTitle, L.inAreaLine(loc.area.etaMinutes, where)],
        outOfArea: [L.outAreaTitle, L.outAreaBody(loc.area.radiusKm, loc.distanceKm)],
        denied: [L.deniedTitle, L.deniedBody],
        error: [L.errorTitle, L.errorBody],
    }[loc.status] || [L.title, L.body];

    const user = useMemo(
        () => (loc.place ? { latitude: loc.place.latitude, longitude: loc.place.longitude } : null),
        [loc.place],
    );

    const progressStyle = useAnimatedStyle(() => ({
        opacity: interpolate(position.value, [0.1, 0.7], [0, 1], Extrapolation.CLAMP),
    }));

    const skip = index < LAST ? () => goTo(LAST) : finish;

    return (
        <Screen edges={[]} background={isDark ? 'canvas' : 'surface'} statusBar="light">
            <GestureDetector gesture={pagerPan}>
                <View style={styles.flex}>
                    {/* the violet scene panel */}
                    <View style={[styles.panel, { height: panelH }]}>
                        <View style={[styles.sceneArea, { top: barH }]}>
                            <ScenePage i={0} position={position} width={width}>
                                <WelcomeScene position={position} width={width} height={sceneH} tiles={preview.tiles} pagerPan={pagerPan} />
                            </ScenePage>
                            <ScenePage i={1} position={position} width={width}>
                                <PackScene width={width} height={sceneH} products={packProducts} active={index === 1} isHi={isHi} T={T} />
                            </ScenePage>
                            <ScenePage i={2} position={position} width={width}>
                                <RideScene
                                    position={position}
                                    width={width}
                                    height={sceneH}
                                    store={loc.area.store}
                                    radiusKm={loc.area.radiusKm}
                                    etaMinutes={etaMinutes}
                                    isHi={isHi}
                                    T={T}
                                    label={copy.track.mapLabel}
                                />
                            </ScenePage>
                            <ScenePage i={3} position={position} width={width}>
                                <DeliveryAreaMap
                                    bare
                                    fill={0.36}
                                    store={loc.area.store}
                                    radiusKm={loc.area.radiusKm}
                                    user={user}
                                    active={index === 3}
                                    label={L.mapLabel(loc.area.radiusKm)}
                                />
                            </ScenePage>
                        </View>

                        <View style={[styles.bar, { paddingTop: insets.top + ONBOARDING_BAR.PAD_TOP }]}>
                            <View style={styles.barRow}>
                                <Logo tone="brand" size={ONBOARDING_BAR.LOGO} />
                                <PressableScale onPress={skip} style={styles.skip} hitSlop={6} accessibilityRole="button" accessibilityLabel={copy.skip}>
                                    <Text style={[T.strong, styles.onBrand]}>{copy.skip}</Text>
                                </PressableScale>
                            </View>
                            <Animated.View
                                style={[styles.progress, progressStyle]}
                                accessibilityRole="progressbar"
                                accessibilityLabel={copy.step(Math.max(1, index), LAST)}
                            >
                                {[0, 1, 2].map((i) => <Segment key={i} position={position} i={i} />)}
                            </Animated.View>
                        </View>
                    </View>

                    {/* the words */}
                    <View style={styles.copyArea}>
                        <CopyPage i={0} position={position} active={index === 0}>
                            {/* the ETA and the stocked kinds arrive from the server: crossfade, never pop */}
                            <ContentSwap stateKey={`${etaMinutes || ''}|${kinds.map((x) => x.en).join(',')}`}>
                                <View style={styles.copy}>
                                    <Text style={[T.display, styles.title]} accessibilityRole="header">{copy.welcome.title(etaMinutes)}</Text>
                                    <Text style={[T.body, styles.body]} color="secondary">{copy.welcome.body(kinds)}</Text>
                                    <Text style={[T.meta, styles.facts]} color="muted">{copy.welcome.facts}</Text>
                                </View>
                            </ContentSwap>
                        </CopyPage>
                        <CopyPage i={1} position={position} active={index === 1}>
                            <View style={styles.copy}>
                                <Text style={[T.display, styles.title]} accessibilityRole="header">{copy.pack.title}</Text>
                                <Text style={[T.body, styles.body]} color="secondary">{copy.pack.body}</Text>
                            </View>
                        </CopyPage>
                        <CopyPage i={2} position={position} active={index === 2}>
                            <View style={styles.copy}>
                                <Text style={[T.display, styles.title]} accessibilityRole="header">{copy.track.title}</Text>
                                <Text style={[T.body, styles.body]} color="secondary">{copy.track.body}</Text>
                            </View>
                        </CopyPage>
                        <CopyPage i={3} position={position} active={index === 3}>
                            <ContentSwap stateKey={loc.status === 'locating' ? 'idle' : loc.status}>
                                <View style={styles.copy} accessibilityLiveRegion="polite">
                                    <Text style={[T.display, styles.title]} accessibilityRole="header">{locText[0]}</Text>
                                    <Text style={[T.body, styles.body]} color="secondary" numberOfLines={3}>{locText[1]}</Text>
                                </View>
                            </ContentSwap>
                        </CopyPage>
                    </View>
                </View>
            </GestureDetector>

            <ContentSwap stateKey={actions.key} style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
                <View style={styles.footerInner}>
                    <Button
                        size="lg"
                        fullWidth
                        label={actions.primary[0]}
                        onPress={actions.primary[1]}
                        loading={index === LAST && loc.status === 'locating'}
                        haptic="medium"
                        labelStyle={T.button}
                    />
                    {actions.link ? (
                        <PressableScale
                            onPress={actions.link[2]}
                            style={styles.link}
                            accessibilityRole="link"
                            accessibilityLabel={`${actions.link[0]} ${actions.link[1]}`}
                        >
                            <Text style={T.body} color="secondary" align="center">
                                {actions.link[0]}{' '}
                                <Text style={[T.body, { fontFamily: T.strong.fontFamily }]} color="brand">{actions.link[1]}</Text>
                            </Text>
                        </PressableScale>
                    ) : null}
                    {actions.back ? (
                        // a quiet way back, which also keeps the footer the same height as the welcome's
                        <PressableScale onPress={actions.back[1]} style={styles.link} accessibilityRole="button" accessibilityLabel={actions.back[0]}>
                            <Text style={[T.body, { fontFamily: T.strong.fontFamily }]} color="secondary" align="center">{actions.back[0]}</Text>
                        </PressableScale>
                    ) : null}
                    {actions.secondary ? (
                        <Button variant="ghost" size="md" fullWidth label={actions.secondary[0]} onPress={actions.secondary[1]} labelStyle={T.button} />
                    ) : null}
                    {actions.note ? (
                        <Text style={[T.meta, styles.note]} color="muted" align="center">{actions.note}</Text>
                    ) : null}
                </View>
            </ContentSwap>
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    panel: {
        backgroundColor: t.colors.brand,
        borderBottomLeftRadius: PANEL_RADIUS,
        borderBottomRightRadius: PANEL_RADIUS,
        overflow: 'hidden',
    },
    sceneArea: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    bar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: SIDE, backgroundColor: t.colors.brand },
    barRow: { height: ONBOARDING_BAR.ROW, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    skip: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
    onBrand: { color: ON_BRAND },
    progress: { flexDirection: 'row', gap: 6, height: 3, marginTop: 6, marginBottom: 3 },
    segment: { flex: 1, height: 3, borderRadius: 1.5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.3)' },
    segmentFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: ON_BRAND },
    copyArea: { flex: 1 },
    copy: { paddingHorizontal: SIDE, paddingTop: 20, paddingBottom: 16, gap: 12 },
    title: { color: t.colors.ink },
    body: { maxWidth: 360 },
    facts: { marginTop: 4 },
    footer: { paddingHorizontal: SIDE, paddingTop: 8 },
    footerInner: { gap: 4 },
    link: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    note: { paddingHorizontal: SIDE, paddingBottom: 4 },
}));

export default OnboardingScreen;
