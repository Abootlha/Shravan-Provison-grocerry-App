/**
 * Terminal-state hero cards and small rows for order tracking.
 *   <DeliveredHero isHi deliveredAt />   SuccessCheck resolves, confetti pops, then a rate-your-order prompt (UI only)
 *   <CancelledHero isHi onShop />        sad mascot (error state, static) + what happens to the money + next step
 *   <HelpRow isHi onPress />             "Need help with this order?" (plain line glyph, no tile)
 *   <TrackingSkeleton topInset />        loading layout that mirrors header + map + cards
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import {
    Button,
    Card,
    ConfettiBurst,
    Mascot,
    PressableScale,
    Skeleton,
    SkeletonGroup,
    SkeletonText,
    SuccessCheck,
    Text,
    haptic,
    toast,
} from '../../components/ui';
import { formatTime } from '../orders/orderUtils';

const RATING_WORDS = {
    en: ['', 'Poor', 'Could be better', 'Okay', 'Good', 'Loved it'],
    hi: ['', 'खराब', 'ठीक नहीं', 'ठीक', 'अच्छा', 'बहुत बढ़िया'],
};

export function DeliveredHero({ isHi, deliveredAt }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const confetti = useRef(null);
    const [status, setStatus] = useState('loading');
    const [rating, setRating] = useState(0);

    useEffect(() => {
        const t = setTimeout(() => setStatus('success'), 260);
        return () => clearTimeout(t);
    }, []);

    const rate = (n) => {
        haptic.selection();
        setRating(n);
        if (n >= 4) toast.success(isHi ? 'रेटिंग के लिए धन्यवाद!' : 'Thanks for rating!');
        else toast.info(isHi ? 'धन्यवाद, हम सुधार करेंगे' : 'Thanks, we will do better');
    };

    const words = isHi ? RATING_WORDS.hi : RATING_WORDS.en;
    return (
        <Card radius="lg" padding="xl" style={styles.center}>
            <View style={styles.checkBox}>
                <SuccessCheck status={status} size={80} onDone={() => confetti.current?.fire()} />
                <ConfettiBurst ref={confetti} />
            </View>
            <Text variant="h3" align="center">{isHi ? 'ऑर्डर डिलीवर हो गया' : 'Order delivered'}</Text>
            {deliveredAt ? (
                <Text variant="caption" color="muted" align="center">
                    {isHi ? `${formatTime(deliveredAt, true)} पर पहुँचाया गया` : `Delivered at ${formatTime(deliveredAt)}`}
                </Text>
            ) : null}
            <View style={styles.rateBox}>
                <Text variant="label" color="secondary" align="center">
                    {rating ? words[rating] : isHi ? 'अपना ऑर्डर रेट करें' : 'How was your order?'}
                </Text>
                <View style={styles.stars} accessibilityRole="radiogroup">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <PressableScale
                            key={n}
                            scaleTo={0.85}
                            onPress={() => rate(n)}
                            style={styles.star}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: rating === n }}
                            accessibilityLabel={`${n} ${isHi ? 'स्टार' : n === 1 ? 'star' : 'stars'}`}
                        >
                            <MaterialCommunityIcons
                                name={n <= rating ? 'star' : 'star-outline'}
                                size={32}
                                color={n <= rating ? colors.brandText : colors.borderStrong}
                            />
                        </PressableScale>
                    ))}
                </View>
            </View>
        </Card>
    );
}

export function CancelledHero({ isHi, onShop }) {
    const styles = useStyles();
    return (
        <Card radius="lg" padding="xl" style={styles.center}>
            <Mascot mood="sad" size={120} />
            <Text variant="h3" align="center">{isHi ? 'यह ऑर्डर रद्द हो गया' : 'This order was cancelled'}</Text>
            <Text variant="body" color="secondary" align="center">
                {isHi
                    ? 'अगर आपने ऑनलाइन भुगतान किया है, तो पैसे 5–7 दिनों में वापस आ जाएँगे।'
                    : 'If you paid online, the amount will be refunded in 5–7 days.'}
            </Text>
            {onShop ? <Button label={isHi ? 'फिर से खरीदारी करें' : 'Continue shopping'} onPress={onShop} style={styles.cta} /> : null}
        </Card>
    );
}

export function HelpRow({ isHi, onPress }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <Card radius="lg" padding="lg" onPress={onPress} accessibilityLabel={isHi ? 'इस ऑर्डर के लिए मदद' : 'Get help with this order'}>
            <View style={styles.helpRow}>
                <MaterialCommunityIcons name="phone-outline" size={20} color={colors.inkSecondary} />
                <View style={styles.flex}>
                    <Text variant="title">{isHi ? 'ऑर्डर में मदद चाहिए?' : 'Need help with this order?'}</Text>
                    <Text variant="caption" color="muted">{isHi ? 'स्टोर को सीधे कॉल करें' : 'Call the store directly'}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.inkMuted} />
            </View>
        </Card>
    );
}

export function TrackingSkeleton({ topInset = 0, mapHeight = 360 }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.flex}>
            <SkeletonGroup style={styles.flex} gap={0}>
                <Skeleton height={mapHeight} radius={0} />
                <View style={[styles.skSheet, { marginTop: -radii.xl }]}>
                    <View style={styles.skHandle} />
                    <SkeletonGroup gap={space.sm}>
                        <Skeleton width={140} height={14} />
                        <Skeleton width="78%" height={34} radius="sm" />
                        <Skeleton width="55%" height={14} />
                    </SkeletonGroup>
                    <View style={styles.skSteps}>
                        {[0, 1, 2, 3].map((i) => <Skeleton key={i} width={36} height={36} radius="pill" />)}
                    </View>
                    <Card radius="lg" bordered elevation="none"><SkeletonText lines={2} /></Card>
                </View>
            </SkeletonGroup>
            <View style={[styles.skChrome, { top: topInset + space.sm }]}>
                <Skeleton width={40} height={40} radius="pill" tint={colors.surface} />
                <Skeleton width={40} height={40} radius="pill" tint={colors.surface} />
            </View>
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    center: { alignItems: 'center', gap: space.sm },
    checkBox: { width: 120, height: 104, alignItems: 'center', justifyContent: 'center' },
    rateBox: { marginTop: space.md, gap: space.xs, alignItems: 'center' },
    stars: { flexDirection: 'row', gap: space.xs },
    star: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    cta: { marginTop: space.sm, alignSelf: 'center' },
    helpRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    skSheet: {
        flex: 1,
        gap: space.xl,
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        backgroundColor: t.colors.surface,
    },
    skHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: radii.pill, backgroundColor: t.colors.border },
    skSteps: { flexDirection: 'row', justifyContent: 'space-around' },
    skChrome: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
}));
