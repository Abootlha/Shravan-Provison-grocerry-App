import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Animated,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginSuccess } from '../store/slices/authSlice';
import { loadLanguage } from '../store/slices/languageSlice';
import api from '../services/api';
import { ENDPOINTS } from '../services/config';

const { width, height } = Dimensions.get('window');

// Cohesive palette matching the onboarding aesthetic
const PALETTE = {
    saffron: '#E85D04',
    deepAmber: '#DC2F02',
    cream: '#FEF3E2',
    espresso: '#1A0F0A',
    turmeric: '#FFBA08',
    warmWhite: '#FFF8F0',
};

const SplashScreen = ({ navigation }) => {
    const dispatch = useDispatch();

    // Orchestrated staggered animations
    const bgAnim = useRef(new Animated.Value(0)).current;
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoRotate = useRef(new Animated.Value(0)).current;
    const titleAnim = useRef(new Animated.Value(0)).current;
    const subtitleAnim = useRef(new Animated.Value(0)).current;
    const decor1Anim = useRef(new Animated.Value(0)).current;
    const decor2Anim = useRef(new Animated.Value(0)).current;
    const decor3Anim = useRef(new Animated.Value(0)).current;
    const footerAnim = useRef(new Animated.Value(0)).current;

    const { isAuthenticated } = useSelector((state) => state.auth);

    useEffect(() => {
        // Orchestrated entrance sequence
        Animated.stagger(80, [
            // Background fade
            Animated.timing(bgAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            // Decorative circles appear
            Animated.spring(decor1Anim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(decor2Anim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(decor3Anim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            // Logo springs in with rotation
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(logoRotate, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ]),
            // Title slides up
            Animated.spring(titleAnim, {
                toValue: 1,
                friction: 8,
                useNativeDriver: true,
            }),
            // Subtitle fades in
            Animated.timing(subtitleAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            // Footer appears
            Animated.timing(footerAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();

        // Check for existing session and navigate
        const checkNavigationDestination = async () => {
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Load saved language preference
            try {
                const savedLanguage = await AsyncStorage.getItem('userLanguage');
                if (savedLanguage) {
                    dispatch(loadLanguage(savedLanguage));
                }
            } catch (error) {
                console.log('No saved language preference');
            }

            try {
                // Try to fetch user profile to validate session (cookies sent automatically)
                const response = await api.get(ENDPOINTS.PROFILE);
                const user = response.data;

                // Session is valid, restore auth state
                dispatch(loginSuccess({
                    user,
                    token: 'cookie-based',
                }));

                navigation.replace('Main');
                return;
            } catch (error) {
                // No valid session, check onboarding status
                console.log('No valid session, redirecting to login');
            }

            // Check language selection and onboarding status
            try {
                const languageSelected = await AsyncStorage.getItem('userLanguage');
                const onboardingComplete = await AsyncStorage.getItem('onboardingComplete');
                
                if (!languageSelected) {
                    // First time user - show language selection
                    navigation.replace('LanguageSelection');
                } else if (onboardingComplete === 'true') {
                    navigation.replace('Login');
                } else {
                    navigation.replace('Onboarding');
                }
            } catch (error) {
                console.error('Navigation check error:', error);
                navigation.replace('LanguageSelection');
            }
        };

        checkNavigationDestination();
    }, []);

    const logoRotation = logoRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['-10deg', '0deg'],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Gradient background layers */}
            <Animated.View style={[styles.bgLayer1, { opacity: bgAnim }]} />
            <Animated.View style={[styles.bgLayer2, { opacity: bgAnim }]} />

            {/* Floating decorative elements */}
            <Animated.View
                style={[
                    styles.decorCircle1,
                    {
                        opacity: decor1Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
                        transform: [{ scale: decor1Anim }],
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.decorCircle2,
                    {
                        opacity: decor2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
                        transform: [{ scale: decor2Anim }],
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.decorRing,
                    {
                        opacity: decor3Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
                    },
                ]}
            />

            {/* Main content */}
            <View style={styles.content}>
                <Animated.View
                    style={[
                        styles.logoWrapper,
                        {
                            opacity: logoScale,
                            transform: [
                                { scale: logoScale },
                                { rotate: logoRotation },
                            ],
                        },
                    ]}
                >
                    <View style={styles.logoInner}>
                        <MaterialCommunityIcons
                            name="store"
                            size={52}
                            color={PALETTE.espresso}
                        />
                    </View>
                    {/* Glow effect */}
                    <View style={styles.logoGlow} />
                </Animated.View>

                {/* Brand name */}
                <Animated.View
                    style={{
                        opacity: titleAnim,
                        transform: [{
                            translateY: titleAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [30, 0],
                            }),
                        }],
                    }}
                >
                    <Text style={styles.brandName}>Shravan</Text>
                    <Text style={styles.brandAccent}>Provision Store</Text>
                </Animated.View>

                {/* Tagline */}
                <Animated.Text
                    style={[
                        styles.tagline,
                        { opacity: subtitleAnim },
                    ]}
                >
                    Your neighborhood store, reimagined
                </Animated.Text>
            </View>

            {/* Footer */}
            <Animated.View
                style={[
                    styles.footer,
                    { opacity: footerAnim },
                ]}
            >
                <View style={styles.footerDot} />
                <Text style={styles.footerText}>QUICK COMMERCE</Text>
                <View style={styles.footerDot} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: PALETTE.saffron,
        overflow: 'hidden',
    },
    bgLayer1: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: PALETTE.deepAmber,
        opacity: 0.6,
    },
    bgLayer2: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: PALETTE.espresso,
        opacity: 0.3,
    },
    decorCircle1: {
        position: 'absolute',
        top: -height * 0.1,
        right: -width * 0.2,
        width: width * 0.7,
        height: width * 0.7,
        borderRadius: width * 0.35,
        backgroundColor: PALETTE.turmeric,
    },
    decorCircle2: {
        position: 'absolute',
        bottom: height * 0.1,
        left: -width * 0.3,
        width: width * 0.6,
        height: width * 0.6,
        borderRadius: width * 0.3,
        backgroundColor: PALETTE.turmeric,
    },
    decorRing: {
        position: 'absolute',
        top: height * 0.35,
        right: -width * 0.15,
        width: width * 0.4,
        height: width * 0.4,
        borderRadius: width * 0.2,
        borderWidth: 3,
        borderColor: PALETTE.cream,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: height * 0.05,
    },
    logoWrapper: {
        marginBottom: height * 0.03,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoInner: {
        width: width * 0.24,
        height: width * 0.24,
        borderRadius: width * 0.07,
        backgroundColor: PALETTE.cream,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: PALETTE.espresso,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 15,
    },
    logoGlow: {
        position: 'absolute',
        width: width * 0.32,
        height: width * 0.32,
        borderRadius: width * 0.1,
        backgroundColor: PALETTE.turmeric,
        opacity: 0.2,
        zIndex: -1,
    },
    brandName: {
        fontSize: Math.min(width * 0.11, 46),
        fontWeight: '900',
        color: PALETTE.cream,
        textAlign: 'center',
        letterSpacing: -1,
        lineHeight: Math.min(width * 0.13, 52),
    },
    brandAccent: {
        fontSize: Math.min(width * 0.09, 38),
        fontWeight: '900',
        color: PALETTE.turmeric,
        textAlign: 'center',
        letterSpacing: -1,
        marginTop: -4,
    },
    tagline: {
        fontSize: Math.min(width * 0.038, 15),
        color: 'rgba(255,255,255,0.7)',
        marginTop: height * 0.02,
        fontWeight: '500',
        letterSpacing: 0.5,
        paddingHorizontal: width * 0.1,
        textAlign: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: height * 0.06,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    footerDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: PALETTE.turmeric,
    },
    footerText: {
        fontSize: Math.min(width * 0.03, 12),
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '700',
        letterSpacing: 3,
    },
});

export default SplashScreen;
