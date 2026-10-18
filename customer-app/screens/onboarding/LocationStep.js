/**
 * LocationStep — the last onboarding page, "Where should we deliver?".
 *
 *   Primer (before the OS prompt): the store and a home joined by a link glyph, the headline and two
 *   ticked benefits. The two ends slide together and the link pops in when the page arrives.
 *   Result (after Continue): a map around the real store with the delivery radius drawing in and the
 *   user's pin dropping in, then an honest verdict: "We deliver here", "Not in our delivery area yet",
 *   "Location is off" or "We couldn't find you". The two states crossfade (ContentSwap).
 *
 * Actions live in the screen footer (OnboardingScreen). Props: loc (useDeliveryLocation), position,
 * index, copy (onboardingCopy(isHi).location).
 */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedReaction,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, easings, springs } from '../../theme/motion';
import { ContentSwap, ICONS_3D, Text } from '../../components/ui';
import { DeliveryAreaMap } from './DeliveryAreaMap';

const END = 92; // the store / home circles
const GAP = 104; // space between them

function LinkHero({ position, index, storeLabel, homeLabel }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const e = useSharedValue(0);
    useAnimatedReaction(
        () => Math.abs(position.value - index) < 0.55,
        (near, was) => {
            if (near && !was && e.value === 0) {
                e.value = reduce ? withTiming(1, { duration: durations.base, easing: easings.out }) : withSpring(1, springs.gentle);
            }
        },
    );
    const left = useAnimatedStyle(() => ({
        opacity: Math.min(1, e.value * 1.5),
        transform: [{ translateX: reduce ? 0 : (1 - e.value) * -36 }, { rotate: `${reduce ? 0 : (1 - e.value) * -10}deg` }],
    }));
    const right = useAnimatedStyle(() => ({
        opacity: Math.min(1, e.value * 1.5),
        transform: [{ translateX: reduce ? 0 : (1 - e.value) * 36 }, { rotate: `${reduce ? 0 : (1 - e.value) * 10}deg` }],
    }));
    const link = useAnimatedStyle(() => {
        const p = interpolate(e.value, [0.45, 1], [0, 1], Extrapolation.CLAMP);
        return { opacity: p, transform: [{ scale: reduce ? 1 : 0.6 + 0.4 * p }] };
    });
    const line = useAnimatedStyle(() => ({ opacity: interpolate(e.value, [0.3, 0.8], [0, 1], Extrapolation.CLAMP) }));

    return (
        <View style={styles.linkHero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <View style={styles.linkRow}>
                <Animated.View style={[styles.lineWrap, line]}>
                    <Svg width={GAP + END} height={4}>
                        <Line x1={0} y1={2} x2={GAP + END} y2={2} stroke={colors.borderStrong} strokeWidth={2} strokeDasharray="4 6" strokeLinecap="round" />
                    </Svg>
                </Animated.View>
                <Animated.View style={[styles.endCol, left]}>
                    <View style={styles.end}>
                        <Image source={ICONS_3D.shopping_bags} style={styles.endIcon} contentFit="contain" accessible={false} />
                    </View>
                    <Text variant="caption" color="secondary" numberOfLines={1}>{storeLabel}</Text>
                </Animated.View>
                <Animated.View style={[styles.link, link]}>
                    <MaterialCommunityIcons name="link-variant" size={18} color={colors.ink} />
                </Animated.View>
                <Animated.View style={[styles.endCol, right]}>
                    <View style={styles.end}>
                        <Image source={ICONS_3D.house} style={styles.endIcon} contentFit="contain" accessible={false} />
                    </View>
                    <Text variant="caption" color="secondary" numberOfLines={1}>{homeLabel}</Text>
                </Animated.View>
            </View>
        </View>
    );
}

function Benefit({ text }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.benefit}>
            <View style={styles.check}>
                <MaterialCommunityIcons name="check" size={14} color={colors.inkInverse} />
            </View>
            <Text variant="bodyStrong" style={styles.flexShrink}>{text}</Text>
        </View>
    );
}

function Verdict({ loc, copy }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { status, place, distanceKm, area } = loc;
    let icon = 'map-marker-off-outline';
    let iconColor = colors.inkSecondary;
    let title;
    let lines = [];
    if (status === 'inArea') {
        icon = 'check-circle';
        iconColor = colors.success;
        title = copy.inArea;
        lines = [
            place?.address || copy.currentLabel,
            area.etaMinutes ? copy.inAreaEta(area.etaMinutes) : distanceKm != null ? copy.inAreaKm(distanceKm) : null,
        ];
    } else if (status === 'outOfArea') {
        title = copy.outArea;
        lines = [place?.address || null, copy.outAreaBody(area.radiusKm, distanceKm)];
    } else if (status === 'denied') {
        icon = 'map-marker-question-outline';
        title = copy.deniedTitle;
        lines = [copy.deniedBody];
    } else {
        icon = 'crosshairs-question';
        title = copy.errorTitle;
        lines = [copy.errorBody];
    }
    return (
        <View style={styles.verdict} accessibilityLiveRegion="polite">
            <View style={styles.verdictHead}>
                <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
                <Text variant="h1" align="center" accessibilityRole="header" style={styles.flexShrink}>{title}</Text>
            </View>
            {lines.filter(Boolean).map((l, i) => (
                <Text key={i} variant={i === 0 && place ? 'bodyStrong' : 'body'} color={i === 0 && place ? 'ink' : 'secondary'} align="center" numberOfLines={i === 0 && place ? 2 : 3}>
                    {l}
                </Text>
            ))}
        </View>
    );
}

export function LocationStep({ loc, position, index, copy }) {
    const styles = useStyles();
    const showMap = loc.status !== 'idle' && loc.status !== 'locating';
    const user = useMemo(
        () => (loc.place ? { latitude: loc.place.latitude, longitude: loc.place.longitude } : null),
        [loc.place],
    );
    return (
        <ContentSwap stateKey={showMap ? 'map' : 'primer'} style={styles.flex}>
            {showMap ? (
                <View style={styles.page}>
                    <View style={styles.mapBox}>
                        <DeliveryAreaMap store={loc.area.store} radiusKm={loc.area.radiusKm} user={user} label={copy.mapLabel(loc.area.radiusKm)} />
                    </View>
                    <Verdict loc={loc} copy={copy} />
                </View>
            ) : (
                <View style={styles.page}>
                    <LinkHero position={position} index={index} storeLabel={copy.storeLabel} homeLabel={copy.homeLabel} />
                    <View style={styles.copy}>
                        <Text variant="display" align="center" accessibilityRole="header">{copy.title}</Text>
                        <View style={styles.benefits}>
                            <Benefit text={copy.benefitEta} />
                            <Benefit text={copy.benefitItems} />
                        </View>
                    </View>
                </View>
            )}
        </ContentSwap>
    );
}

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    flexShrink: { flexShrink: 1 },
    page: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.xl },
    linkHero: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 140 },
    linkRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', width: END * 2 + GAP },
    endCol: { width: END, alignItems: 'center', gap: space.sm },
    lineWrap: { position: 'absolute', left: END / 2, top: END / 2 - 2 },
    end: {
        width: END,
        height: END,
        borderRadius: END / 2,
        backgroundColor: t.colors.imageWell,
        alignItems: 'center',
        justifyContent: 'center',
    },
    endIcon: { width: 52, height: 52 },
    link: {
        width: 40,
        height: 40,
        marginHorizontal: (GAP - 40) / 2,
        marginTop: END / 2 - 20,
        borderRadius: 20,
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copy: { gap: space.xl, alignItems: 'center' },
    benefits: { gap: space.md, alignSelf: 'center' },
    benefit: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    check: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: t.colors.surfaceInverse,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapBox: { flex: 1, minHeight: 200 },
    verdict: { gap: space.sm, alignItems: 'center', paddingHorizontal: space.sm },
    verdictHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));

export default LocationStep;
