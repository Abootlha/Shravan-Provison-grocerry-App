import React, { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, ConfettiBurst, Mascot, PressableScale, SuccessCheck, Text } from '../../components/ui';
import { HIT, radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { durations, easings, springs } from '../../theme/motion';
import { PAYMENT_STEP } from './useCheckout';

/** Fades + lifts its children in whenever `id` changes (text crossfade between steps). */
const FadeSwap = ({ id, children, style }) => {
    const reduce = useReducedMotion();
    const o = useSharedValue(1);
    const y = useSharedValue(0);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        o.value = 0;
        o.value = withTiming(1, { duration: durations.base, easing: easings.out });
        if (!reduce) {
            y.value = 8;
            y.value = withSpring(0, springs.gentle);
        }
    }, [id, reduce]);
    const s = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
    return <Animated.View style={[style, s]}>{children}</Animated.View>;
};

/**
 * The "Arriving in N mins" line. Sequencing: the surface fades in with the modal → the violet
 * disc fills and the check draws → one confetti burst → THIS rises 14px on a gentle spring
 * with a fade, so the ETA is the last beat. Reduced motion: fade only.
 */
const EtaLine = ({ show, children, style }) => {
    const reduce = useReducedMotion();
    const o = useSharedValue(0);
    const y = useSharedValue(reduce ? 0 : 14);
    useEffect(() => {
        if (!show) return;
        o.value = withDelay(60, withTiming(1, { duration: durations.base, easing: easings.out }));
        if (!reduce) y.value = withDelay(60, withSpring(0, springs.gentle));
    }, [show, reduce]);
    const s = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
    return <Animated.View style={[style, s]}>{children}</Animated.View>;
};

/** Quiet text action (Close / Cancel) in secondary ink, so the one violet button stays primary. */
const QuietLink = ({ label, onPress }) => {
    const styles = useStyles();
    return (
        <PressableScale onPress={onPress} haptic="light" accessibilityRole="button" accessibilityLabel={label} style={styles.link}>
            <Text variant="button" color="secondary">{label}</Text>
        </PressableScale>
    );
};

const copyFor = (step, isCod, isHi) => {
    switch (step) {
        case PAYMENT_STEP.CONNECTING:
            return isCod
                ? { title: isHi ? 'आपका ऑर्डर दिया जा रहा है…' : 'Placing your order…' }
                : { title: isHi ? 'सुरक्षित भुगतान से जुड़ रहे हैं…' : 'Connecting to secure payment…' };
        case PAYMENT_STEP.VERIFYING:
            return isCod
                ? { title: isHi ? 'आपका ऑर्डर दिया जा रहा है…' : 'Placing your order…' }
                : { title: isHi ? 'भुगतान की पुष्टि हो रही है…' : 'Confirming your payment…' };
        case PAYMENT_STEP.APPROVED:
            return {
                title: isHi ? 'ऑर्डर हो गया' : 'Order placed',
                body: isHi ? 'लाइव ट्रैकिंग खोल रहे हैं।' : 'Opening live tracking.',
            };
        case PAYMENT_STEP.STILL_VERIFYING:
            return {
                title: isHi ? 'भुगतान की पुष्टि अभी बाकी है' : 'Still confirming your payment',
                body: isHi
                    ? 'बैंक से पुष्टि में कुछ मिनट लग सकते हैं। दोबारा भुगतान न करें, थोड़ी देर बाद फिर से जांचें।'
                    : 'Your bank can take a few minutes to confirm. Don’t pay again; check again in a moment.',
            };
        case PAYMENT_STEP.FAILED:
        default:
            return isCod
                ? {
                    title: isHi ? 'ऑर्डर नहीं हो सका' : 'We couldn’t place your order',
                    body: isHi
                        ? 'कनेक्शन जांचें और फिर से प्रयास करें। आपकी कार्ट सुरक्षित है।'
                        : 'Check your connection and try again. Your cart is saved.',
                }
                : {
                    title: isHi ? 'भुगतान पूरा नहीं हुआ' : 'Payment didn’t go through',
                    body: isHi
                        ? 'भुगतान पूरा नहीं हुआ, इसलिए ऑर्डर नहीं दिया गया। फिर से प्रयास करें या डिलीवरी पर भुगतान चुनें।'
                        : 'The payment wasn’t completed, so the order wasn’t placed. Try again, or pay on delivery instead.',
                };
    }
};

/**
 * Full-screen payment / order status on the plain surface: connecting → verifying → placed
 * (violet check + one confetti burst), plus "still verifying" and failure (cause + next action).
 * All actions come from useCheckout.
 */
export function PaymentStatusOverlay({
    visible,
    step: liveStep,
    amount,
    methodName,
    isCod,
    onCancel,
    onCheckAgain,
    onCloseVerification,
    onRetry,
    onPayOnDelivery,
    onDismissFailure,
    etaMinutes = 10,
    isHi,
}) {
    const styles = useStyles();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const confetti = useRef(null);
    // Keep showing the last step while the modal fades out (the flow resets to 0 on close).
    const shownStep = useRef(liveStep);
    if (visible) shownStep.current = liveStep;
    const step = shownStep.current;
    const failed = step === PAYMENT_STEP.FAILED;
    const waiting = step === PAYMENT_STEP.STILL_VERIFYING;
    const busy = step === PAYMENT_STEP.CONNECTING || step === PAYMENT_STEP.VERIFYING;
    const copy = copyFor(step, isCod, isHi);

    const approved = step === PAYMENT_STEP.APPROVED;
    const reduce = useReducedMotion();
    // Set when the check has finished drawing; releases the confetti and then the ETA line.
    const [celebrated, setCelebrated] = useState(false);
    useEffect(() => {
        if (!approved) setCelebrated(false);
    }, [approved]);
    const onCheckDrawn = () => {
        confetti.current?.fire();
        setCelebrated(true);
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={failed ? onDismissFailure : () => {}}
        >
            <View style={styles.root}>
                <View style={[styles.inner, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl }]}>
                    <View style={styles.top}>
                        {!isCod && busy ? (
                            <View style={styles.secure}>
                                <MaterialCommunityIcons name="shield-lock-outline" size={14} color={colors.inkMuted} />
                                <Text variant="caption" color="muted">
                                    {isHi ? 'सुरक्षित भुगतान' : 'Secure payment'}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.center} accessibilityLiveRegion="polite">
                        <View style={styles.visual}>
                            {failed ? (
                                <Mascot mood="sad" size={120} />
                            ) : waiting ? (
                                <View style={styles.waitIcon}>
                                    <MaterialCommunityIcons name="clock-outline" size={40} color={colors.inkSecondary} />
                                </View>
                            ) : (
                                <>
                                    <SuccessCheck size={96} status={approved ? 'success' : 'loading'} onDone={onCheckDrawn} />
                                    <ConfettiBurst ref={confetti} count={16} spread={130} />
                                </>
                            )}
                        </View>

                        <FadeSwap id={step} style={styles.copy}>
                            <Text variant="h1" color="strong" align="center" accessibilityRole="header">{copy.title}</Text>
                            {copy.body ? <Text variant="body" color="secondary" align="center">{copy.body}</Text> : null}
                        </FadeSwap>

                        {approved ? (
                            <EtaLine show={celebrated || reduce}>
                                <Text variant="body" color="secondary" align="center">
                                    {isHi ? 'पहुँचने में ' : 'Arriving in '}
                                    <Text variant="bodyStrong" color="strong">
                                        {isHi ? `${etaMinutes} मिनट` : `${etaMinutes} mins`}
                                    </Text>
                                </Text>
                            </EtaLine>
                        ) : null}

                        {amount != null ? (
                            <View style={styles.amountRow}>
                                <Text variant="priceLarge" color="strong">₹{amount}</Text>
                                {methodName ? <Text variant="caption" color="muted" numberOfLines={1}>· {methodName}</Text> : null}
                            </View>
                        ) : null}

                        {busy ? (
                            <Text variant="caption" color="muted" align="center">
                                {isHi ? 'कृपया ऐप बंद न करें और बैक न दबाएं' : 'Please don’t close the app or press back'}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.actions}>
                        {step === PAYMENT_STEP.CONNECTING ? (
                            <QuietLink
                                label={isCod ? (isHi ? 'रद्द करें' : 'Cancel order') : (isHi ? 'भुगतान रद्द करें' : 'Cancel payment')}
                                onPress={onCancel}
                            />
                        ) : null}
                        {waiting ? (
                            <>
                                <Button label={isHi ? 'फिर से जांचें' : 'Check again'} size="lg" fullWidth onPress={onCheckAgain} />
                                <QuietLink label={isHi ? 'बंद करें' : 'Close'} onPress={onCloseVerification} />
                            </>
                        ) : null}
                        {failed ? (
                            <>
                                <Button label={isHi ? 'फिर से प्रयास करें' : 'Try again'} size="lg" fullWidth onPress={onRetry} />
                                {!isCod ? (
                                    <Button
                                        label={isHi ? 'डिलीवरी पर भुगतान करें' : 'Pay on delivery instead'}
                                        variant="outline"
                                        size="lg"
                                        fullWidth
                                        onPress={onPayOnDelivery}
                                    />
                                ) : null}
                                <QuietLink label={isHi ? 'बंद करें' : 'Close'} onPress={onDismissFailure} />
                            </>
                        ) : null}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const useStyles = makeStyles((t) => ({
    root: { flex: 1, backgroundColor: t.colors.surface },
    inner: { flex: 1, paddingHorizontal: space['2xl'] },
    top: { alignItems: 'center', minHeight: HIT - space.md },
    secure: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
    visual: { width: 160, height: 140, alignItems: 'center', justifyContent: 'center' },
    waitIcon: {
        width: 88,
        height: 88,
        borderRadius: radii.pill,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    copy: { alignItems: 'center', gap: space.sm, maxWidth: 340 },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, maxWidth: '100%' },
    actions: { gap: space.sm, minHeight: HIT },
    link: { minHeight: HIT, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
}));

export default PaymentStatusOverlay;
