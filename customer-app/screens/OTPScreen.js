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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginSuccess } from '../store/slices/authSlice';
import { AuthService } from '../services';
import { useTranslation } from '../hooks/useTranslation';

const { width, height } = Dimensions.get('window');

// Matching palette from LoginScreen
const PALETTE = {
    charcoal: '#1C1917',
    warmBlack: '#0C0A09',
    coffee: '#292524',
    sand: '#D6D3D1',
    cream: '#FEF3E2',
    terracotta: '#EA580C',
    amber: '#F59E0B',
    warmGray: '#78716C',
    emerald: '#10B981',
};

const OTPScreen = ({ navigation, route }) => {
    const { phoneNumber } = route.params;
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const [otp, setOtp] = useState(['', '', '', '']);
    const [timer, setTimer] = useState(30);
    const [canResend, setCanResend] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    const inputRefs = [useRef(), useRef(), useRef(), useRef()];

    // Staggered entrance animations
    const bgAnim = useRef(new Animated.Value(0)).current;
    const decorAnim = useRef(new Animated.Value(0)).current;
    const iconAnim = useRef(new Animated.Value(0)).current;
    const titleAnim = useRef(new Animated.Value(0)).current;
    const otpAnim = useRef(new Animated.Value(0)).current;
    const buttonAnim = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;
    const inputPulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.stagger(80, [
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
            Animated.spring(iconAnim, {
                toValue: 1,
                friction: 5,
                useNativeDriver: true,
            }),
            Animated.spring(titleAnim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(otpAnim, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
            }),
            Animated.spring(buttonAnim, {
                toValue: 1,
                friction: 6,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // Countdown timer
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
            return () => clearInterval(interval);
        } else {
            setCanResend(true);
        }
    }, [timer]);

    const handleOtpChange = (value, index) => {
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 3) {
            inputRefs[index + 1].current?.focus();
        }

        if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 4) {
            handleVerify(newOtp.join(''));
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs[index - 1].current?.focus();
        }
    };

    const handleVerify = async (otpCode) => {
        if (isVerifying) return;
        setIsVerifying(true);

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
            if (tokens.accessToken) {
                await AsyncStorage.setItem('customerAccessToken', tokens.accessToken);
            }
            if (tokens.refreshToken) {
                await AsyncStorage.setItem('customerRefreshToken', tokens.refreshToken);
            }

            dispatch(loginSuccess({
                user,
                token: tokens.accessToken || null,
                refreshToken: tokens.refreshToken || null,
            }));

            // Navigate to main
            navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
            });
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Invalid OTP. Please try again.';
            Alert.alert('Verification Failed', errorMessage);
            setOtp(['', '', '', '']);
            inputRefs[0].current?.focus();
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;

        try {
            await AuthService.sendOtp(phoneNumber);
            setTimer(30);
            setCanResend(false);
            setOtp(['', '', '', '']);
            inputRefs[0].current?.focus();
        } catch (error) {
            Alert.alert('Error', 'Failed to resend OTP. Please try again.');
        }
    };

    const isComplete = otp.every(digit => digit !== '');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Decorative background */}
            <Animated.View
                style={[
                    styles.decorCircle1,
                    {
                        opacity: decorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.05] }),
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
                {/* Header */}
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
                    {/* Lock Icon */}
                    <Animated.View
                        style={[
                            styles.iconContainer,
                            {
                                opacity: iconAnim,
                                transform: [{ scale: iconAnim }],
                            },
                        ]}
                    >
                        <View style={styles.iconWrapper}>
                            <MaterialCommunityIcons
                                name="shield-lock"
                                size={Math.min(width * 0.08, 32)}
                                color={PALETTE.charcoal}
                            />
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
                        <Text style={styles.title}>{t('enterOTP')}</Text>
                        <Text style={styles.subtitle}>
                            {t('otpSentTo')}{'\n'}
                            <Text style={styles.phoneNumber}>+91 {phoneNumber}</Text>
                        </Text>
                    </Animated.View>

                    {/* OTP Inputs */}
                    <Animated.View
                        style={[
                            styles.otpContainer,
                            {
                                opacity: otpAnim,
                                transform: [{
                                    translateY: otpAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [30, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        {otp.map((digit, index) => (
                            <TextInput
                                key={index}
                                ref={inputRefs[index]}
                                style={[
                                    styles.otpInput,
                                    digit && styles.otpInputFilled,
                                ]}
                                value={digit}
                                onChangeText={(value) => handleOtpChange(value, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                autoFocus={index === 0}
                                selectTextOnFocus
                            />
                        ))}
                    </Animated.View>

                    {/* Resend */}
                    <Animated.View style={[styles.resendContainer, { opacity: otpAnim }]}>
                        {canResend ? (
                            <TouchableOpacity onPress={handleResend} style={styles.resendButton}>
                                <MaterialCommunityIcons name="refresh" size={16} color={PALETTE.terracotta} />
                                <Text style={styles.resendLink}>{t('resend')}</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.timerContainer}>
                                <Text style={styles.resendText}>{t('resend')} </Text>
                                <View style={styles.timerBadge}>
                                    <Text style={styles.timerText}>{timer}s</Text>
                                </View>
                            </View>
                        )}
                    </Animated.View>
                </View>

                {/* Verify Button */}
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
                            styles.verifyButton,
                            isComplete && styles.verifyButtonActive,
                        ]}
                        onPress={() => handleVerify(otp.join(''))}
                        disabled={!isComplete || isVerifying}
                        activeOpacity={0.85}
                    >
                        {isVerifying ? (
                            <Text style={[styles.verifyText, styles.verifyTextActive]}>
                                {t('verify')}...
                            </Text>
                        ) : (
                            <>
                                <Text style={[
                                    styles.verifyText,
                                    isComplete && styles.verifyTextActive,
                                ]}>
                                    {t('verify')}
                                </Text>
                                <View style={[
                                    styles.checkWrapper,
                                    isComplete && styles.checkWrapperActive,
                                ]}>
                                    <MaterialCommunityIcons
                                        name="check"
                                        size={18}
                                        color={isComplete ? PALETTE.charcoal : PALETTE.warmGray}
                                    />
                                </View>
                            </>
                        )}
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
        top: -height * 0.12,
        right: -width * 0.25,
        width: width * 0.7,
        height: width * 0.7,
        borderRadius: width * 0.35,
        backgroundColor: PALETTE.emerald,
    },
    decorCircle2: {
        position: 'absolute',
        bottom: height * 0.25,
        left: -width * 0.35,
        width: width * 0.6,
        height: width * 0.6,
        borderRadius: width * 0.3,
        backgroundColor: PALETTE.terracotta,
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
    iconContainer: {
        alignItems: 'center',
        marginBottom: height * 0.03,
    },
    iconWrapper: {
        width: Math.min(width * 0.16, 64),
        height: Math.min(width * 0.16, 64),
        borderRadius: 20,
        backgroundColor: PALETTE.emerald,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: Math.min(width * 0.065, 26),
        fontWeight: '900',
        color: PALETTE.cream,
        textAlign: 'center',
        marginBottom: height * 0.01,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: Math.min(width * 0.038, 15),
        color: PALETTE.warmGray,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: height * 0.04,
    },
    phoneNumber: {
        color: PALETTE.cream,
        fontWeight: '700',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: width * 0.035,
        marginBottom: height * 0.035,
    },
    otpInput: {
        width: Math.min(width * 0.16, 64),
        height: Math.min(width * 0.16, 64),
        borderRadius: 16,
        backgroundColor: PALETTE.coffee,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.08)',
        fontSize: Math.min(width * 0.065, 26),
        fontWeight: '800',
        textAlign: 'center',
        color: PALETTE.cream,
    },
    otpInputFilled: {
        borderColor: PALETTE.emerald,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    resendContainer: {
        alignItems: 'center',
    },
    resendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    resendText: {
        fontSize: Math.min(width * 0.035, 14),
        color: PALETTE.warmGray,
    },
    resendLink: {
        fontSize: Math.min(width * 0.035, 14),
        color: PALETTE.terracotta,
        fontWeight: '700',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timerBadge: {
        backgroundColor: PALETTE.coffee,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    timerText: {
        fontSize: Math.min(width * 0.035, 14),
        color: PALETTE.amber,
        fontWeight: '700',
    },
    footer: {
        paddingHorizontal: width * 0.07,
        paddingBottom: height * 0.05,
    },
    verifyButton: {
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
    verifyButtonActive: {
        backgroundColor: PALETTE.emerald,
        borderColor: PALETTE.emerald,
    },
    verifyText: {
        fontSize: Math.min(width * 0.043, 17),
        fontWeight: '800',
        color: PALETTE.warmGray,
        letterSpacing: 0.5,
    },
    verifyTextActive: {
        color: PALETTE.cream,
    },
    checkWrapper: {
        width: Math.min(width * 0.08, 32),
        height: Math.min(width * 0.08, 32),
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkWrapperActive: {
        backgroundColor: PALETTE.cream,
    },
});

export default OTPScreen;
