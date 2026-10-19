import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, DeviceEventEmitter, Platform, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useTranslation } from '../hooks/useTranslation';
import { dockIcon, useDockInset, useTabBarHeight } from '../components/BottomTabsIcons';
import { FloatingDock } from '../components/ui';
import { space, z } from '../constants/theme';
import { springs, durations, easings, transitions } from '../theme/motion';
import { makeThemed } from '../theme';

import {
    SplashScreen,
    OnboardingScreen,
    LoginScreen,
    OTPScreen,
    HomeScreen,
    CategoryScreen,
    CategoriesScreen,
    ProductDetailScreen,
    SearchScreen,
    CheckoutScreen,
    OrderTrackingScreen,
    OrderDetailsScreen,
    ProfileScreen,
    ProfileSettingsScreen,
    OrdersHistoryScreen,
    LocationScreen,
    AddAddressScreen,
    WishlistScreen,
} from '../screens';
import LanguageSelectionScreen from '../screens/LanguageSelectionScreen';

// Dev-only design-system playground. Open it on web with http://localhost:<port>/?ds
const DesignSystemScreen = __DEV__ ? require('../screens/DesignSystemScreen').default : null;
const DEV_INITIAL_ROUTE =
    __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && /[?&]ds(=|&|$)/.test(window.location.search)
        ? 'DesignSystem'
        : undefined;

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Floating dock (Part C #3). Content scrolls behind it; screens pad their lists by
// useTabBarHeight(). Screens can hide it while scrolling down by emitting
// SET_TAB_BAR_VISIBLE(false); it springs back on (true) and on every tab switch.
// A tab that sets `tabBarStyle: { display: 'none' }` (Cart with items) keeps the dock hidden.
const CustomTabBar = ({ state, descriptors, navigation }) => {
    const totalItems = useSelector((s) => s.cart.totalItems);
    const { t } = useTranslation();
    const reduce = useReducedMotion();
    const dockInset = useDockInset();
    const travel = useTabBarHeight() + space.lg; // fully below the screen edge, shadow included
    const hidden = useSharedValue(0);
    const focusedKey = state.routes[state.index]?.key;
    const routeHidesDock = descriptors[focusedKey]?.options?.tabBarStyle?.display === 'none';

    // ONE source of truth for "is the dock up": the focused tab's option AND the scroll signal.
    // Both the slide and the touch layer derive from `visible`, so the dock can never be on
    // screen while its layer ignores taps (Home → View cart → back used to leave it dead).
    const [scrollHidden, setScrollHidden] = useState(false);
    const visible = !routeHidesDock && !scrollHidden;

    useEffect(() => {
        setScrollHidden(false); // every tab switch brings the dock back
    }, [state.index]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('SET_TAB_BAR_VISIBLE', (v) => setScrollHidden(v === false));
        return () => sub.remove();
    }, []);

    useEffect(() => {
        const to = visible ? 0 : 1;
        hidden.value = reduce ? withTiming(to, { duration: durations.fast, easing: easings.out }) : withSpring(to, springs.sheet);
    }, [visible, reduce]);

    const slide = useAnimatedStyle(() =>
        reduce ? { opacity: 1 - hidden.value } : { opacity: 1 - hidden.value * 0.4, transform: [{ translateY: hidden.value * travel }] },
    );

    const tabLabels = {
        Home: t('home'),
        Categories: t('categories'),
        Search: t('search'),
        Cart: t('cart'),
        Account: t('account'),
    };

    const items = state.routes.map((route) => {
        const label = tabLabels[route.name] || descriptors[route.key]?.options?.title || route.name;
        const badge = route.name === 'Cart' ? totalItems || 0 : 0;
        return {
            key: route.key,
            label,
            icon: ICONS[route.name] || dockIcon(route.name),
            badge,
            accessibilityLabel: badge > 0 ? `${label}, ${badge}` : label,
        };
    });

    const onSelect = (key) => {
        const route = state.routes.find((r) => r.key === key);
        if (!route) return;
        const isFocused = state.routes[state.index]?.key === key;
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
        }
    };

    return (
        // pointerEvents only ever comes from StyleSheet.create styles: on web an INLINE
        // { pointerEvents } that flips 'none' → 'box-none' leaves `pointer-events: none` stuck on the
        // element (react-native-web), which is what left the dock visible but dead.
        <View style={[styles.dockLayer, { height: travel }, visible ? styles.passThrough : styles.noTouch]}>
            <Animated.View style={[styles.fill, styles.passThrough, slide]}>
                <FloatingDock items={items} activeKey={state.routes[state.index]?.key} onSelect={onSelect} bottomInset={dockInset} />
            </Animated.View>
        </View>
    );
};

const ICONS = {
    Home: dockIcon('Home'),
    Categories: dockIcon('Categories'),
    Search: dockIcon('Search'),
    Cart: dockIcon('Cart'),
    Account: dockIcon('Account'),
};

// Screen backgrounds follow the active theme (one object per scheme, cached).
// Stack default = motion-spec "Global": iOS-style slide_from_right on both platforms (320ms) with a
// full-width back gesture. Tabs don't slide: each tab screen crossfades + rises its own body on a tab
// switch (screens/home/useTabEnter, ui/AnimatedScreen replayOnFocus; neither replays on a stack pop).
const useNavOptions = makeThemed((t) => ({
    stack: { headerShown: false, contentStyle: { backgroundColor: t.colors.canvas }, ...transitions.push },
    // Tab scenes must be opaque: inactive tabs can stay mounted (always on web), and a transparent
    // scene lets the previous tab show through during and after a switch.
    tab: { headerShown: false, sceneStyle: { backgroundColor: t.colors.canvas }, animation: 'none' },
}));
// ProductDetail cross-fades so the card → PDP hero image (components/ui/HeroTransition) is the
// only thing that travels; a slide would fight it. Short and the same both ways.
const PDP_OPTIONS = transitions.fade;
// Splash hands over without a slide (the splash logo / gradient carry the moment); the store itself
// fades in after splash or sign-in rather than sliding a whole new world across.
const SPLASH_OPTIONS = transitions.none;
const MAIN_OPTIONS = { ...transitions.fade, gestureEnabled: false };
// Auth flow: horizontal slide, logo position shared by the screens themselves.
const AUTH_OPTIONS = transitions.auth;
// The first screen after splash crossfades out of it (splash gradient -> onboarding gradient).
const FIRST_RUN_OPTIONS = transitions.fade;
// The address picker is a sheet-like, bottom-up task (motion-spec: address flows aren't pushes).
const SHEET_OPTIONS = transitions.modal;

// Tab Navigator
const TabNavigator = () => {
    const opts = useNavOptions();
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={opts.tab}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Categories" component={CategoriesScreen} />
            <Tab.Screen name="Search" component={SearchScreen} />
            <Tab.Screen name="Cart" component={CheckoutScreen} />
            <Tab.Screen name="Account" component={ProfileScreen} />
        </Tab.Navigator>
    );
};

// Cart / Search opened from a pushed screen (e.g. the Category header's icons call
// navigate('Main', { screen: 'Cart' })) used to pop that screen and switch tabs, so there was no way
// back. From any stack screen above Main they now open as stack screens on top instead (Checkout /
// StackSearch, both with a back arrow), keeping the screen you came from underneath.
const STACK_TWIN = { Cart: 'Checkout', Search: 'StackSearch' };
const keepOriginRouter = (original) => ({
    getStateForAction(state, action, options) {
        const nav = action.type === 'NAVIGATE' ? action.payload : null;
        // navigate('Main', { screen: 'Cart' }) or a bare navigate('Cart') from a stack screen
        const viaMain = nav?.name === 'Main' ? nav.params?.screen : null;
        const target = viaMain || (STACK_TWIN[nav?.name] ? nav.name : null);
        const twin = target && STACK_TWIN[target];
        const focused = state.routes[state.index]?.name;
        if (twin && focused && focused !== 'Main') {
            const params = viaMain ? nav.params?.params : nav.params;
            return original.getStateForAction(state, { ...action, type: 'PUSH', payload: { name: twin, params } }, options);
        }
        return original.getStateForAction(state, action, options);
    },
});

// Main App Navigator
const AppNavigator = () => {
    const opts = useNavOptions();
    return (
        <Stack.Navigator screenOptions={opts.stack} initialRouteName={DEV_INITIAL_ROUTE || 'Splash'} UNSTABLE_router={keepOriginRouter}>
            <Stack.Screen name="Splash" component={SplashScreen} options={SPLASH_OPTIONS} />
            <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} options={FIRST_RUN_OPTIONS} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={FIRST_RUN_OPTIONS} />
            <Stack.Screen name="Login" component={LoginScreen} options={AUTH_OPTIONS} />
            <Stack.Screen name="OTP" component={OTPScreen} options={AUTH_OPTIONS} />
            <Stack.Screen name="Main" component={TabNavigator} options={MAIN_OPTIONS} />
            <Stack.Screen name="Category" component={CategoryScreen} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={PDP_OPTIONS} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="StackSearch" component={SearchScreen} />
            <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            <Stack.Screen name="OrdersHistory" component={OrdersHistoryScreen} />
            <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
            <Stack.Screen name="Location" component={LocationScreen} options={SHEET_OPTIONS} />
            <Stack.Screen name="AddAddress" component={AddAddressScreen} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} />
            {__DEV__ && DesignSystemScreen ? <Stack.Screen name="DesignSystem" component={DesignSystemScreen} /> : null}
        </Stack.Navigator>
    );
};

const styles = StyleSheet.create({
    dockLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: z.tabBar },
    fill: { flex: 1 },
    passThrough: { pointerEvents: 'box-none' },
    noTouch: { pointerEvents: 'none' },
});

export default AppNavigator;
