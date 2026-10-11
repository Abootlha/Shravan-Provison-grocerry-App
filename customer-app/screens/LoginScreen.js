/**
 * LoginScreen — flat canvas (DESIGN.md "Auth/onboarding"): the AuthBar logo, a still life of everyday
 * produce in a neutral image well, a plain headline, and one surface card holding the "+91" phone
 * field (auto-formatted "98765 43210", violet focus ring) and the violet Continue button. Sends the OTP
 * via AuthService.sendOtp and opens OTP (unchanged).
 * Motion: the bar stays put while the content slides left into OTP (and back from the left on return);
 * the focus ring springs in; opened from Splash, the bar logo settles into place.
 * Theme: canvas + surface card in both modes (dark: #0F0F0F / #1A1A1A).
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, space, type } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { springs, durations, easings } from '../theme/motion';
import { Image } from 'expo-image';
import { Button, IconButton, Screen, Text, toast } from '../components/ui';
import { AuthService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { AuthBar, AuthHeading } from './auth/AuthHero';
import { useFromSplashHandoff, useSheetSlide } from './auth/authMotion';

const ART = require('../assets/onboarding/daily-vegetables.webp');

const formatPhone = (digits) => (digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);

const LoginScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const logoStyle = useFromSplashHandoff(route, navigation);
    const slide = useSheetSlide();
    const reduce = useReducedMotion();
    const { t, isHi } = useTranslation();
    const insets = useSafeAreaInsets();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Focus ring: springs out from the field edge (scale 0.96 → 1) while it fades in.
    const ring = useSharedValue(0);
    React.useEffect(() => {
        ring.value = reduce
            ? withTiming(isFocused ? 1 : 0, { duration: durations.fast, easing: easings.out })
            : withSpring(isFocused ? 1 : 0, springs.snappy);
    }, [isFocused, reduce, ring]);
    const ringStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, Math.max(0, ring.value)),
        transform: [{ scaleX: 0.97 + 0.03 * ring.value }, { scaleY: 0.9 + 0.1 * ring.value }],
    }));

    const handlePhoneChange = (text) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length <= 10) {
            setPhoneNumber(cleaned);
            setIsValid(cleaned.length === 10);
        }
    };

    const handleContinue = async () => {
        if (!isValid || isLoading) return;

        setIsLoading(true);

        try {
            const response = await AuthService.sendOtp(phoneNumber);
            if (response.message) {
                slide.leave(-1);
                navigation.navigate('OTP', { phoneNumber });
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to send OTP. Please try again.';
            toast.error(isHi ? 'OTP नहीं भेजा जा सका' : "Couldn't send the OTP", { description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Onboarding'));

    return (
        <Screen edges={[]} background="canvas">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
                <AuthBar onBack={goBack} backLabel={isHi ? 'वापस जाएँ' : 'Go back'} logoStyle={logoStyle} />
                <ScrollView
                    contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={[styles.body, slide.style]}>
                        <View style={styles.well}>
                            <Image source={ART} style={styles.art} contentFit="contain" accessible={false} transition={0} />
                        </View>

                        <AuthHeading
                            title={isHi ? 'लॉग इन या साइन अप करें' : 'Log in or sign up'}
                            subtitle={t('verifyText')}
                        />

                        <View style={styles.card}>
                            <Text variant="label" color="secondary">{isHi ? 'मोबाइल नंबर' : 'Mobile number'}</Text>
                            <View style={styles.fieldWrap}>
                                <Animated.View style={[styles.focusRing, ringStyle, { pointerEvents: 'none' }]} />
                                <View style={[styles.field, isFocused && styles.fieldFocused]}>
                                    <View style={styles.prefix}>
                                        <Text variant="title" tabular>+91</Text>
                                    </View>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={t('digitNumber')}
                                        placeholderTextColor={colors.inkMuted}
                                        value={formatPhone(phoneNumber)}
                                        onChangeText={handlePhoneChange}
                                        keyboardType="phone-pad"
                                        textContentType="telephoneNumber"
                                        autoComplete="tel-national"
                                        maxLength={11}
                                        onFocus={() => setIsFocused(true)}
                                        onBlur={() => setIsFocused(false)}
                                        onSubmitEditing={handleContinue}
                                        returnKeyType="done"
                                        accessibilityLabel={isHi ? 'मोबाइल नंबर' : 'Mobile number'}
                                        selectionColor={colors.brand}
                                        keyboardAppearance={isDark ? 'dark' : 'light'}
                                        autoFocus
                                    />
                                    {phoneNumber.length > 0 ? (
                                        <IconButton
                                            name="close-circle"
                                            variant="ghost"
                                            size="sm"
                                            color={colors.inkMuted}
                                            haptic={false}
                                            accessibilityLabel={isHi ? 'नंबर साफ़ करें' : 'Clear number'}
                                            onPress={() => {
                                                setPhoneNumber('');
                                                setIsValid(false);
                                            }}
                                        />
                                    ) : null}
                                </View>
                            </View>

                            <Button
                                size="lg"
                                fullWidth
                                label={t('continue')}
                                loading={isLoading}
                                disabled={!isValid}
                                onPress={handleContinue}
                            />
                        </View>

                        <Text variant="caption" color="muted" align="center" style={styles.terms}>
                            {t('byContinu')}{' '}
                            <Text variant="caption" color="ink" style={styles.link}>{t('terms')}</Text>
                            {' '}{t('and')}{' '}
                            <Text variant="caption" color="ink" style={styles.link}>{t('privacyPolicy')}</Text>
                        </Text>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingTop: space.sm },
    body: { gap: space.xl },
    well: { height: 176, borderRadius: radii.card, backgroundColor: t.colors.imageWell, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    art: { width: '86%', height: '86%' },
    card: {
        backgroundColor: t.colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        padding: space.lg,
        gap: space.md,
    },
    fieldWrap: { position: 'relative', marginBottom: space.xs },
    // Brand-tint ring outside the violet border; springs in on focus.
    focusRing: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: radii.input + 4, backgroundColor: t.colors.brandTint },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 52,
        paddingLeft: space.md,
        paddingRight: space.xs,
        borderRadius: radii.input,
        borderWidth: 1.5,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface,
    },
    fieldFocused: { borderColor: t.colors.accent },
    prefix: { paddingRight: space.md, marginRight: space.md, borderRightWidth: 1, borderRightColor: t.colors.border, height: 24, justifyContent: 'center' },
    input: {
        flex: 1,
        ...type.title,
        fontVariant: ['tabular-nums'],
        color: t.colors.ink,
        paddingVertical: space.md,
        outlineStyle: 'none',
    },
    terms: { paddingHorizontal: space.lg },
    link: { textDecorationLine: 'underline' },
}));

export default LoginScreen;
