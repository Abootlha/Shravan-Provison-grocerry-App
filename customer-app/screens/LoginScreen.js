import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Alert,
    ActivityIndicator,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthService } from '../services';
import { useTranslation } from '../hooks/useTranslation';

const PALETTE = {
    charcoal: '#1C1917',
    warmBlack: '#0C0A09',
    coffee: '#292524',
    sand: '#D6D3D1',
    cream: '#FEF3E2',
    terracotta: '#EA580C',
    amber: '#F59E0B',
    warmGray: '#78716C',
};

const LoginScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const { width, height } = useWindowDimensions();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const bgAnim = useRef(new Animated.Value(0)).current;
    const decorAnim = useRef(new Animated.Value(0)).current;
    const logoAnim = useRef(new Animated.Value(0)).current;
    const titleAnim = useRef(new Animated.Value(0)).current;
    const inputAnim = useRef(new Animated.Value(0)).current;
    const buttonAnim = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

    const isCompact = width < 420;
    const horizontalPadding = Math.max(Math.min(width * 0.07, 28), 20);
    const topPadding = Platform.OS === 'web' ? 28 : Math.max(height * 0.06, 24);
    const bottomPadding = Platform.OS === 'web' ? 16 : Math.max(height * 0.03, 20);
    const circleSizeLarge = Math.min(width * 1.15, 520);
    const circleSizeSmall = Math.min(width * 0.9, 420);

    useEffect(() => {
        Animated.stagger(100, [
            Animated.timing(bgAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(decorAnim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(logoAnim, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
            }),
            Animated.spring(titleAnim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(inputAnim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(buttonAnim, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
            }),
        ]).start();
    }, [bgAnim, decorAnim, logoAnim, titleAnim, inputAnim, buttonAnim]);

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

        Animated.sequence([
            Animated.timing(buttonScale, {
                toValue: 0.95,
                duration: 80,
                useNativeDriver: true,
            }),
            Animated.timing(buttonScale, {
                toValue: 1,
                duration: 80,
                useNativeDriver: true,
            }),
        ]).start();

        try {
            const response = await AuthService.sendOtp(phoneNumber);

            if (response.message) {
                navigation.navigate('OTP', { phoneNumber });
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to send OTP. Please try again.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const titleSize = isCompact ? 30 : 34;
    const subtitleMargin = isCompact ? 22 : 30;
    const logoBoxSize = isCompact ? 52 : 56;
    const iconSize = isCompact ? 28 : 34;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <Animated.View
                style={[
                    styles.decorCircle,
                    {
                        top: -circleSizeLarge * 0.28,
                        right: -circleSizeLarge * 0.42,
                        width: circleSizeLarge,
                        height: circleSizeLarge,
                        borderRadius: circleSizeLarge / 2,
                        backgroundColor: PALETTE.terracotta,
                        opacity: decorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }),
                        transform: [{ scale: decorAnim }],
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.decorCircle,
                    {
                        bottom: Math.max(height * 0.12, 72),
                        left: -circleSizeSmall * 0.45,
                        width: circleSizeSmall,
                        height: circleSizeSmall,
                        borderRadius: circleSizeSmall / 2,
                        backgroundColor: PALETTE.amber,
                        opacity: decorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] }),
                        transform: [{ scale: decorAnim }],
                    },
                ]}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: topPadding,
                            paddingBottom: bottomPadding,
                            paddingHorizontal: horizontalPadding,
                        },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={[styles.header, { opacity: bgAnim }]}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => (
                                navigation.canGoBack()
                                    ? navigation.goBack()
                                    : navigation.navigate('Onboarding')
                            )}
                        >
                            <MaterialCommunityIcons name="arrow-left" size={22} color={PALETTE.sand} />
                        </TouchableOpacity>
                    </Animated.View>

                    <View style={styles.body}>
                        <Animated.View
                            style={[
                                styles.logoContainer,
                                {
                                    opacity: logoAnim,
                                    transform: [{
                                        translateY: logoAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [30, 0],
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <View style={[styles.logoWrapper, { width: logoBoxSize, height: logoBoxSize }]}>
                                <MaterialCommunityIcons
                                    name="store"
                                    size={iconSize}
                                    color={PALETTE.charcoal}
                                />
                            </View>
                            <View style={styles.brandContainer}>
                                <Text style={[styles.brandName, { fontSize: isCompact ? 20 : 22 }]}>Shravan</Text>
                                <Text style={[styles.brandAccent, { fontSize: isCompact ? 13 : 14 }]}>
                                    Provision Store
                                </Text>
                            </View>
                        </Animated.View>

                        <Animated.View
                            style={{
                                opacity: titleAnim,
                                transform: [{
                                    translateY: titleAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [20, 0],
                                    }),
                                }],
                            }}
                        >
                            <Text style={[styles.title, { fontSize: titleSize }]}>{t('whatsYourNumber')}</Text>
                            <Text style={[styles.subtitle, { marginBottom: subtitleMargin }]}>
                                {t('verifyText')}
                            </Text>
                        </Animated.View>

                        <Animated.View
                            style={[
                                styles.inputWrapper,
                                {
                                    opacity: inputAnim,
                                    transform: [{
                                        translateY: inputAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [20, 0],
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.inputContainer,
                                    {
                                        minHeight: isCompact ? 58 : 64,
                                        paddingHorizontal: isCompact ? 16 : 18,
                                    },
                                    isFocused && styles.inputContainerFocused,
                                ]}
                            >
                                <View style={styles.countryCode}>
                                    <Text style={styles.flag}>🇮🇳</Text>
                                    <Text style={styles.code}>+91</Text>
                                </View>
                                <View style={[styles.divider, { marginHorizontal: isCompact ? 14 : 16 }]} />
                                <TextInput
                                    style={[
                                        styles.phoneInput,
                                        {
                                            fontSize: isCompact ? 18 : 20,
                                            letterSpacing: isCompact ? 0.5 : 1,
                                        },
                                    ]}
                                    placeholder={t('digitNumber')}
                                    placeholderTextColor={PALETTE.warmGray}
                                    value={phoneNumber}
                                    onChangeText={handlePhoneChange}
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    autoFocus
                                />
                                {phoneNumber.length > 0 && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setPhoneNumber('');
                                            setIsValid(false);
                                        }}
                                        style={styles.clearButton}
                                    >
                                        <MaterialCommunityIcons
                                            name="close-circle"
                                            size={20}
                                            color={PALETTE.warmGray}
                                        />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <Text style={styles.terms}>
                                {t('byContinu')}{' '}
                                <Text style={styles.termsLink}>{t('terms')}</Text>
                                {' '}{t('and')}{' '}
                                <Text style={styles.termsLink}>{t('privacyPolicy')}</Text>
                            </Text>
                        </Animated.View>
                    </View>

                    <Animated.View
                        style={[
                            styles.footer,
                            {
                                opacity: buttonAnim,
                                transform: [
                                    { scale: buttonScale },
                                    {
                                        translateY: buttonAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [30, 0],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={[
                                styles.continueButton,
                                isValid && styles.continueButtonActive,
                            ]}
                            onPress={handleContinue}
                            disabled={!isValid || isLoading}
                            activeOpacity={0.85}
                        >
                            <Text style={[
                                styles.continueText,
                                isValid && styles.continueTextActive,
                            ]}>
                                {t('continue')}
                            </Text>
                            <View style={[
                                styles.arrowWrapper,
                                isValid && styles.arrowWrapperActive,
                            ]}>
                                {isLoading ? (
                                    <ActivityIndicator
                                        size="small"
                                        color={isValid ? PALETTE.charcoal : PALETTE.warmGray}
                                    />
                                ) : (
                                    <MaterialCommunityIcons
                                        name="arrow-right"
                                        size={18}
                                        color={isValid ? PALETTE.charcoal : PALETTE.warmGray}
                                    />
                                )}
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PALETTE.warmBlack,
        overflow: 'hidden',
    },
    decorCircle: {
        position: 'absolute',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'space-between',
    },
    header: {
        paddingBottom: 8,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: PALETTE.coffee,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    body: {
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
        flexGrow: 1,
        justifyContent: 'center',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 16,
    },
    logoWrapper: {
        borderRadius: 16,
        backgroundColor: PALETTE.amber,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    brandContainer: {
        flexDirection: 'column',
        flexShrink: 1,
    },
    brandName: {
        fontWeight: '800',
        color: PALETTE.cream,
        letterSpacing: -0.5,
    },
    brandAccent: {
        fontWeight: '600',
        color: PALETTE.amber,
        letterSpacing: 0.5,
        marginTop: -2,
    },
    title: {
        fontWeight: '900',
        color: PALETTE.cream,
        marginBottom: 10,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 15,
        color: PALETTE.warmGray,
        lineHeight: 22,
        maxWidth: 420,
    },
    inputWrapper: {
        gap: 18,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: PALETTE.coffee,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.06)',
        width: '100%',
    },
    inputContainerFocused: {
        borderColor: PALETTE.terracotta,
    },
    countryCode: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    flag: {
        fontSize: 20,
    },
    code: {
        fontSize: 17,
        fontWeight: '700',
        color: PALETTE.sand,
    },
    divider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(255,255,255,0.1)',
        flexShrink: 0,
    },
    phoneInput: {
        flex: 1,
        minWidth: 0,
        fontWeight: '600',
        color: PALETTE.cream,
        paddingVertical: 0,
    },
    clearButton: {
        padding: 6,
        marginLeft: 8,
    },
    terms: {
        fontSize: 12,
        color: PALETTE.warmGray,
        textAlign: 'left',
        lineHeight: 18,
    },
    termsLink: {
        color: PALETTE.terracotta,
        fontWeight: '700',
    },
    footer: {
        width: '100%',
        maxWidth: 480,
        alignSelf: 'center',
        paddingTop: 24,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: PALETTE.coffee,
        minHeight: 60,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    continueButtonActive: {
        backgroundColor: PALETTE.terracotta,
        borderColor: PALETTE.terracotta,
    },
    continueText: {
        fontSize: 17,
        fontWeight: '800',
        color: PALETTE.warmGray,
        letterSpacing: 0.5,
    },
    continueTextActive: {
        color: PALETTE.cream,
    },
    arrowWrapper: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrowWrapperActive: {
        backgroundColor: PALETTE.cream,
    },
});

export default LoginScreen;
