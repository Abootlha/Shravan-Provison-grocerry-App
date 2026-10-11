/**
 * OTPScreen — 4-digit code on the flat auth canvas: AuthBar, a plain "Enter the 4-digit code" headline
 * with the number it went to, and one surface card with the boxes, the resend countdown and Verify.
 * One hidden input feeds the boxes (typing, SMS autofill and paste all work), the 4th digit
 * auto-submits, a wrong code shakes the row with an error haptic. Verify/token/session logic unchanged.
 * Motion: the bar stays fixed (fade transition) while the content slides in from the right;
 * boxes pop in staggered; on success the boxes turn green, then the app opens (~0.45 s later).
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Animated from 'react-native-reanimated';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { radii, space } from '../constants/theme';
import { makeStyles } from '../theme';
import { Button, Screen, Text, haptic, toast } from '../components/ui';
import { setTokens } from '../services/tokenStorage';
import { loginSuccess } from '../store/slices/authSlice';
import { AuthService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { AuthBar, AuthHeading } from './auth/AuthHero';
import { OtpBoxes } from './auth/OtpBoxes';
import { ResendRing } from './auth/ResendRing';
import { useSheetSlide } from './auth/authMotion';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;
const SUCCESS_HOLD_MS = 450; // boxes turn green, then the app opens

const OTPScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const slide = useSheetSlide({ from: 1 });
    const { phoneNumber } = route.params;
    const { t, isHi } = useTranslation();
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const inputRef = useRef(null);

    const [otp, setOtp] = useState('');
    const [timer, setTimer] = useState(RESEND_SECONDS);
    const [canResend, setCanResend] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState(null);
    const [shakeKey, setShakeKey] = useState(0);
    const [verified, setVerified] = useState(false);

    // Hero stays still between Login and OTP: only the sheet content moves.
    useLayoutEffect(() => {
        navigation.setOptions?.({ animation: 'fade', animationDuration: 220 });
    }, [navigation]);

    // Countdown timer
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(interval);
        }
        setCanResend(true);
        return undefined;
    }, [timer]);

    const handleOtpChange = (digits) => {
        setOtp(digits);
        if (error) setError(null);
        if (digits.length === OTP_LENGTH) {
            handleVerify(digits);
        }
    };

    const handleVerify = async (otpCode) => {
        if (isVerifying) return;

        setIsVerifying(true);

        try {
            const response = await AuthService.verifyOtp(phoneNumber, otpCode);

            const tokens = {
                accessToken: response.accessToken || response.tokens?.accessToken || null,
                refreshToken: response.refreshToken || response.tokens?.refreshToken || null,
            };
            const user = {
                id: response.user?.id || response.userId || phoneNumber,
                name: response.user?.name || 'Customer',
                phone: phoneNumber,
            };

            await AsyncStorage.setItem('customerUser', JSON.stringify(user));
            await setTokens({
                accessToken: tokens.accessToken || undefined,
                refreshToken: tokens.refreshToken || undefined,
            });

            dispatch(loginSuccess({
                user,
                token: tokens.accessToken || null,
                refreshToken: tokens.refreshToken || null,
            }));

            haptic.success();
            setVerified(true);
            // Let the boxes turn green, then navigate to main
            setTimeout(() => {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                });
            }, SUCCESS_HOLD_MS);
        } catch (err) {
            const errorMessage = err.response?.data?.message || (isHi ? 'गलत OTP। फिर से कोशिश करें।' : 'Wrong OTP. Please try again.');
            haptic.error();
            setError(errorMessage);
            setShakeKey((k) => k + 1);
            setOtp('');
            inputRef.current?.focus();
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;
        setIsResending(true);
        try {
            await AuthService.sendOtp(phoneNumber);
            setTimer(RESEND_SECONDS);
            setCanResend(false);
            setOtp('');
            setError(null);
            inputRef.current?.focus();
            toast.success(isHi ? 'नया OTP भेजा गया' : 'New code sent');
        } catch (err) {
            toast.error(isHi ? 'OTP दोबारा नहीं भेजा जा सका' : "Couldn't resend the OTP", {
                description: isHi ? 'कृपया फिर से कोशिश करें।' : 'Please try again.',
            });
        } finally {
            setIsResending(false);
        }
    };

    const isComplete = otp.length === OTP_LENGTH;
    const prettyPhone = `+91 ${phoneNumber.slice(0, 5)} ${phoneNumber.slice(5)}`;

    return (
        <Screen edges={[]} background="canvas">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <AuthBar onBack={() => navigation.goBack()} backLabel={isHi ? 'वापस जाएँ' : 'Go back'} />
                <ScrollView
                    contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={[styles.body, slide.style]}>
                        <AuthHeading
                            title={isHi ? `${OTP_LENGTH} अंकों का कोड डालें` : `Enter the ${OTP_LENGTH}-digit code`}
                            subtitle={`${t('otpSentTo')} ${prettyPhone}`}
                        />

                        <View style={styles.card}>
                            <View style={styles.otpBlock}>
                                <OtpBoxes
                                    value={otp}
                                    onChange={handleOtpChange}
                                    length={OTP_LENGTH}
                                    error={Boolean(error)}
                                    success={verified}
                                    shakeKey={shakeKey}
                                    inputRef={inputRef}
                                    disabled={isVerifying || verified}
                                    accessibilityLabel={isHi ? `${OTP_LENGTH} अंकों का OTP` : `${OTP_LENGTH}-digit code`}
                                />
                                <View style={styles.errorSlot} accessibilityLiveRegion="assertive">
                                    {error ? <Text variant="label" color="error" align="center" accessibilityRole="alert">{error}</Text> : null}
                                </View>
                            </View>

                            <Button
                                size="lg"
                                fullWidth
                                label={t('verify')}
                                loading={isVerifying || verified}
                                disabled={!isComplete || verified}
                                onPress={() => handleVerify(otp)}
                            />

                            <ResendRing
                                seconds={timer}
                                total={RESEND_SECONDS}
                                onResend={handleResend}
                                loading={isResending}
                                label={isHi ? 'OTP दोबारा भेजें' : 'Resend code'}
                                waitingLabel={isHi ? 'दोबारा भेजें' : 'Resend code in'}
                            />
                        </View>

                        <Button
                            variant="ghost"
                            size="sm"
                            label={isHi ? 'नंबर बदलें' : 'Change number'}
                            onPress={() => navigation.goBack()}
                            style={styles.center}
                        />
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingTop: space.lg },
    body: { gap: space.xl },
    card: {
        backgroundColor: t.colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        padding: space.lg,
        paddingTop: space.xl,
        gap: space.md,
    },
    otpBlock: { gap: space.sm },
    center: { alignSelf: 'center' },
    errorSlot: { minHeight: 20 },
}));

export default OTPScreen;
