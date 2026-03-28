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
    Dimensions,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthService } from '../services';
import { useTranslation } from '../hooks/useTranslation';

const { width, height } = Dimensions.get('window');

// Bold, distinctive palette - warm earth tones with sharp accents
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
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Staggered entrance animations
    const bgAnim = useRef(new Animated.Value(0)).current;
    const decorAnim = useRef(new Animated.Value(0)).current;
    const logoAnim = useRef(new Animated.Value(0)).current;
    const titleAnim = useRef(new Animated.Value(0)).current;
    const inputAnim = useRef(new Animated.Value(0)).current;
    const buttonAnim = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;

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
    }, []);

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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Decorative background elements */}
            <Animated.View
                style={[
                    styles.decorCircle1,
                    {
                        opacity: decorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }),
                        transform: [{ scale: decorAnim }],
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.decorCircle2,
                    {
                        opacity: decorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.04] }),
                        transform: [{ scale: decorAnim }],
                    },
                ]}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                {/* Back Button */}
                <Animated.View style={[styles.header, { opacity: bgAnim }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <MaterialCommunityIcons name="arrow-left" size={22} color={PALETTE.sand} />
                    </TouchableOpacity>
                </Animated.View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Logo */}
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
                        <View style={styles.logoWrapper}>
                            <MaterialCommunityIcons
                                name="store"
                                size={Math.min(width * 0.09, 36)}
                                color={PALETTE.charcoal}
                            />
                        </View>
                        <View style={styles.brandContainer}>
                            <Text style={styles.brandName}>Shravan</Text>
                            <Text style={styles.brandAccent}>Provision Store</Text>
                        </View>
                    </Animated.View>

                    {/* Title */}
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
                        <Text style={styles.title}>{t('whatsYourNumber')}</Text>
                        <Text style={styles.subtitle}>
                            {t('verifyText')}
                        </Text>
                    </Animated.View>

                    {/* Phone Input */}
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
                        <View style={[
                            styles.inputContainer,
                            isFocused && styles.inputContainerFocused,
                        ]}>
                            <View style={styles.countryCode}>
                                <Text style={styles.flag}>🇮🇳</Text>
                                <Text style={styles.code}>+91</Text>
                            </View>
                            <View style={styles.divider} />
                            <TextInput
                                style={styles.phoneInput}
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
                                    onPress={() => setPhoneNumber('')}
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

                        {/* Terms */}
                        <Text style={styles.terms}>
                            {t('byContinu')}{' '}
                            <Text style={styles.termsLink}>{t('terms')}</Text>
                            {' '}{t('and')}{' '}
                            <Text style={styles.termsLink}>{t('privacyPolicy')}</Text>
                        </Text>
                    </Animated.View>
                </View>

                {/* Continue Button */}
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
                        disabled={!isValid}
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
                            <MaterialCommunityIcons
                                name="arrow-right"
                                size={18}
                                color={isValid ? PALETTE.charcoal : PALETTE.warmGray}
                            />
                        </View>
                    </TouchableOpacity>
                </Animated.View>
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
    decorCircle1: {
        position: 'absolute',
        top: -height * 0.15,
        right: -width * 0.3,
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
        backgroundColor: PALETTE.terracotta,
    },
    decorCircle2: {
        position: 'absolute',
        bottom: height * 0.2,
        left: -width * 0.4,
        width: width * 0.7,
        height: width * 0.7,
        borderRadius: width * 0.35,
        backgroundColor: PALETTE.amber,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        paddingHorizontal: width * 0.05,
        paddingTop: height * 0.07,
        paddingBottom: height * 0.02,
    },
    backButton: {
        width: Math.min(width * 0.12, 44),
        height: Math.min(width * 0.12, 44),
        borderRadius: 14,
        backgroundColor: PALETTE.coffee,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    content: {
        flex: 1,
        paddingHorizontal: width * 0.07,
        justifyContent: 'center',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: height * 0.04,
        gap: width * 0.035,
    },
    logoWrapper: {
        width: Math.min(width * 0.14, 56),
        height: Math.min(width * 0.14, 56),
        borderRadius: 16,
        backgroundColor: PALETTE.amber,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandContainer: {
        flexDirection: 'column',
    },
    brandName: {
        fontSize: Math.min(width * 0.055, 22),
        fontWeight: '800',
        color: PALETTE.cream,
        letterSpacing: -0.5,
    },
    brandAccent: {
        fontSize: Math.min(width * 0.035, 14),
        fontWeight: '600',
        color: PALETTE.amber,
        letterSpacing: 0.5,
        marginTop: -2,
    },
    title: {
        fontSize: Math.min(width * 0.075, 30),
        fontWeight: '900',
        color: PALETTE.cream,
        marginBottom: height * 0.012,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: Math.min(width * 0.038, 15),
        color: PALETTE.warmGray,
        marginBottom: height * 0.035,
        lineHeight: 22,
    },
    inputWrapper: {
        gap: height * 0.025,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: PALETTE.coffee,
        borderRadius: 16,
        paddingHorizontal: width * 0.045,
        height: Math.min(height * 0.075, 64),
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    inputContainerFocused: {
        borderColor: PALETTE.terracotta,
    },
    countryCode: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: width * 0.02,
    },
    flag: {
        fontSize: Math.min(width * 0.05, 20),
    },
    code: {
        fontSize: Math.min(width * 0.043, 17),
        fontWeight: '700',
        color: PALETTE.sand,
    },
    divider: {
        width: 1,
        height: height * 0.035,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: width * 0.04,
    },
    phoneInput: {
        flex: 1,
        fontSize: Math.min(width * 0.045, 18),
        fontWeight: '600',
        color: PALETTE.cream,
        letterSpacing: 2,
    },
    clearButton: {
        padding: 6,
    },
    terms: {
        fontSize: Math.min(width * 0.03, 12),
        color: PALETTE.warmGray,
        textAlign: 'center',
        lineHeight: 18,
    },
    termsLink: {
        color: PALETTE.terracotta,
        fontWeight: '700',
    },
    footer: {
        paddingHorizontal: width * 0.07,
        paddingBottom: height * 0.05,
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: PALETTE.coffee,
        paddingVertical: height * 0.022,
        paddingHorizontal: width * 0.02,
        borderRadius: 16,
        gap: width * 0.03,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    continueButtonActive: {
        backgroundColor: PALETTE.terracotta,
        borderColor: PALETTE.terracotta,
    },
    continueText: {
        fontSize: Math.min(width * 0.043, 17),
        fontWeight: '800',
        color: PALETTE.warmGray,
        letterSpacing: 0.5,
    },
    continueTextActive: {
        color: PALETTE.cream,
    },
    arrowWrapper: {
        width: Math.min(width * 0.08, 32),
        height: Math.min(width * 0.08, 32),
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
