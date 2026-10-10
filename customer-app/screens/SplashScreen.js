/**
 * SplashScreen — the brand moment, continuous with the native splash (app.json → expo-splash-screen):
 * the same violet bag mark, centred, on the same flat background (white; dark: canvas #0F0F0F). The
 * wordmark rises in under it once, then the lockup hands over to the next screen. Going to Login /
 * Onboarding, the mark FLIES to where that screen's AuthBar logo sits (shared position) while the
 * wordmark dissolves; the next screen opens with a fade and its own logo settles in from the same spot
 * (screens/auth/authMotion → useFromSplashHandoff). Anywhere else it fades out.
 * No gradient, no ring bloom, no tile, no loops (DESIGN.md). Init and redirect logic is unchanged:
 * saved language → saved session (→ Main, or Checkout on a web PayU return) → language
 * selection / onboarding / login. Total time ≈ 1.1 s.
 */
import React, { useEffect, useRef } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { springs, durations, easings } from '../theme/motion';
import { Logo, LogoMark, Screen, Text } from '../components/ui';
import { getAccessToken, getRefreshToken } from '../services/tokenStorage';
import { parsePaymentReturnUrl } from '../services/paymentService';
import { loginSuccess } from '../store/slices/authSlice';
import { loadLanguage } from '../store/slices/languageSlice';
import { AUTH_BAR, authBarMarkCentre } from './auth/authMotion';

const MIN_SPLASH_MS = 900;
const FLIGHT_MS = 280; // the hand-over starts once the mark has (nearly) landed
const MARK = 88; // = app.json expo-splash-screen imageWidth, so native → JS is seamless
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SplashScreen = ({ navigation }) => {
    const styles = useStyles();
    const { isDark } = useTheme();
    const dispatch = useDispatch();
    const reduce = useReducedMotion();
    const insets = useSafeAreaInsets();
    const { width: W } = useWindowDimensions();

    const word = useSharedValue(0);
    const exit = useSharedValue(0);
    const fly = useSharedValue(0);
    // Where the destination's AuthBar logo MARK sits, as an offset from the screen centre.
    const flyTo = useSharedValue({ dx: 0, dy: 0, s: 1 });
    const heightRef = useRef(0);

    useEffect(() => {
        word.value = withDelay(120, withSpring(1, springs.gentle));

        const startedAt = Date.now();
        // Hand over to the next screen: fly the mark into its AuthBar (Login / Onboarding) or fade out.
        const go = async (fn, target) => {
            const wait = MIN_SPLASH_MS - (Date.now() - startedAt);
            if (wait > 0) await sleep(wait);
            const H = heightRef.current;
            if (target && H && !reduce) {
                const c = authBarMarkCentre();
                flyTo.value = { dx: c.dx, dy: insets.top + c.dy - H / 2, s: AUTH_BAR.LOGO / MARK };
                fly.value = withSpring(1, springs.snappy);
                await sleep(FLIGHT_MS);
                fn();
                return;
            }
            exit.value = withTiming(1, { duration: durations.base, easing: easings.out });
            await sleep(durations.base - 40);
            fn();
        };

        // Check for existing session and navigate
        const checkNavigationDestination = async () => {
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
                const userJson = await AsyncStorage.getItem('customerUser');
                const token = await getAccessToken();
                const refreshToken = await getRefreshToken();

                if (!userJson || !token) {
                    throw new Error('No saved session');
                }

                const user = JSON.parse(userJson);
                dispatch(loginSuccess({
                    user,
                    token,
                    refreshToken,
                }));

                // Web: back from PayU (PAYMENT_RETURN_URL?payment=...&orderId=...).
                // Hand off to Checkout, which verifies the payment with the server.
                const paymentReturn = Platform.OS === 'web' && typeof window !== 'undefined'
                    ? parsePaymentReturnUrl(window.location.href)
                    : null;
                if (paymentReturn) {
                    window.history.replaceState(null, '', window.location.pathname);
                    await go(() => navigation.reset({
                        index: 1,
                        routes: [
                            { name: 'Main' },
                            { name: 'Checkout', params: paymentReturn },
                        ],
                    }));
                    return;
                }

                await go(() => navigation.replace('Main'));
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
                    await go(() => navigation.replace('LanguageSelection'));
                } else if (onboardingComplete === 'true') {
                    await go(() => navigation.replace('Login', { fromSplash: true }), 'login');
                } else {
                    await go(() => navigation.replace('Onboarding', { fromSplash: true }), 'onboarding');
                }
            } catch (error) {
                console.error('Navigation check error:', error);
                navigation.replace('LanguageSelection');
            }
        };

        checkNavigationDestination();
    }, []);

    const markStyle = useAnimatedStyle(() => {
        const f = fly.value;
        const { dx, dy, s: sc } = flyTo.value;
        return {
            opacity: 1 - exit.value,
            transform: [{ translateX: dx * f }, { translateY: dy * f }, { scale: 1 - (1 - sc) * f }],
        };
    });
    const wordStyle = useAnimatedStyle(() => ({
        opacity: word.value * (1 - Math.min(1, fly.value * 2.2)) * (1 - exit.value),
        transform: [{ translateY: reduce ? 0 : (1 - word.value) * 12 }],
    }));

    return (
        <Screen edges={[]} background={isDark ? 'canvas' : 'surface'}>
            <View
                style={styles.fill}
                onLayout={(e) => {
                    heightRef.current = e.nativeEvent.layout.height;
                }}
            >
                <Animated.View style={[styles.mark, markStyle]}>
                    <LogoMark size={MARK} />
                </Animated.View>
                <Animated.View style={[styles.words, wordStyle]}>
                    <Logo variant="wordmark" size={30} />
                    <Text variant="body" color="secondary" align="center">
                        Your neighbourhood kirana, delivered
                    </Text>
                </Animated.View>
            </View>
        </Screen>
    );
};

const useStyles = makeStyles(() => ({
    fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    mark: { width: MARK, height: MARK },
    // Hangs under the centred mark so the mark stays exactly where the native splash drew it.
    words: { position: 'absolute', top: '50%', left: 0, right: 0, marginTop: MARK / 2 + space.xl, alignItems: 'center', gap: space.sm },
}));

export default SplashScreen;
