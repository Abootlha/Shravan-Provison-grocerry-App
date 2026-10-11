import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { store } from './store';
import { AppNavigator } from './navigation';
import { WishlistToast } from './components';
import { ToastHost, FlyToCartProvider, HeroTransitionProvider } from './components/ui';
import { ThemeProvider, useTheme, useNavigationTheme } from './theme';

// Keep the native splash up until fonts are ready (the in-app animated SplashScreen
// route takes over after that). No-op on web.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
    // ThemeProvider renders nothing until the saved mode is read, so the first frame is in the right scheme.
    return (
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    );
}

function ThemedApp() {
    const { colors, isDark } = useTheme();
    const navTheme = useNavigationTheme();
    const [fontsLoaded, fontError] = useFonts({
        PlusJakartaSans_400Regular,
        PlusJakartaSans_500Medium,
        PlusJakartaSans_600SemiBold,
        PlusJakartaSans_700Bold,
        PlusJakartaSans_800ExtraBold,
        BricolageGrotesque_600SemiBold,
        BricolageGrotesque_700Bold,
        BricolageGrotesque_800ExtraBold,
    });
    const ready = fontsLoaded || !!fontError;

    useEffect(() => {
        if (ready) SplashScreen.hideAsync().catch(() => {});
    }, [ready]);

    if (!ready) return null;

    return (
        <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.canvas }]}>
            {/* app-wide default; a <Screen statusBar> further down overrides it per screen */}
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Provider store={store}>
                <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                    <NavigationContainer theme={navTheme}>
                        {/* Signature-motion overlays (fly-to-cart, card → PDP hero) sit above the navigator. */}
                        <HeroTransitionProvider>
                            <FlyToCartProvider>
                                <AppNavigator />
                                <WishlistToast />
                                <ToastHost />
                            </FlyToCartProvider>
                        </HeroTransitionProvider>
                    </NavigationContainer>
                </SafeAreaProvider>
            </Provider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
});
