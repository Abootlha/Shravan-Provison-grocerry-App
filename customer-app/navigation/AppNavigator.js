import React, { useRef, useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity, Animated, DeviceEventEmitter, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    Home01Icon,
    GridViewIcon,
    Search01Icon,
    ShoppingCart01Icon,
    UserIcon,
    Delete02Icon,
} from 'hugeicons-react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from '../hooks/useTranslation';
import { HomeSvgIcon, SearchSvgIcon, CategoriesSvgIcon, ProfileSvgIcon } from '../components/BottomTabsIcons';

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
import { COLORS } from '../constants';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


// Custom Tab Bar with Blinkit/Zepto Style Finger-Tracking Scroll Animation
const CustomTabBar = ({ state, descriptors, navigation }) => {
    const totalItems = useSelector((s) => s.cart.totalItems);
    const { t } = useTranslation();
    const scrollY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Always reset tab bar position to visible when switching tabs
        scrollY.setValue(0);
    }, [state.index]);

    useEffect(() => {
        const listener = DeviceEventEmitter.addListener('ON_SCROLL_Y', (y) => {
            scrollY.setValue(y);
        });
        const resetListener = DeviceEventEmitter.addListener('SET_TAB_BAR_VISIBLE', (visible) => {
            if (visible) {
                scrollY.setValue(0);
            }
        });
        return () => {
            listener.remove();
            resetListener.remove();
        };
    }, []);

    const diffClampScroll = Animated.diffClamp(scrollY, 0, 90);
    const translateY = diffClampScroll.interpolate({
        inputRange: [0, 90],
        outputRange: [0, 90],
        extrapolate: 'clamp',
    });

    const currentRouteName = state.routes[state.index]?.name;
    if (currentRouteName === 'Account') {
        return null;
    }

    const tabLabels = {
        Home: t('home'),
        Categories: t('categories'),
        Search: t('search'),
        Cart: t('cart'),
        Account: t('account'),
    };

    return (
        <Animated.View style={[styles.tabBarWrapper, { transform: [{ translateY }] }]}>
            <View style={styles.tabBar}>
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const isFocused = state.index === index;

                    const tabIconMap = {
                        Home: HomeSvgIcon,
                        Categories: CategoriesSvgIcon,
                        Search: SearchSvgIcon,
                        Cart: ShoppingCart01Icon,
                        Account: ProfileSvgIcon,
                    };

                    const IconComponent = tabIconMap[route.name];

                    const onPress = () => {
                        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            onPress={onPress}
                            style={styles.tabItem}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.iconContainer, isFocused && styles.tabContentPillActive]}>
                                {IconComponent && (
                                    <IconComponent
                                        size={24}
                                        color={isFocused ? '#6C3CF4' : COLORS.textSecondary}
                                        strokeWidth={isFocused ? 2.5 : 2}
                                    />
                                )}
                                {route.name === 'Cart' && totalItems > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{totalItems}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                                {tabLabels[route.name]}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </Animated.View>
    );
};

// Tab Navigator
const TabNavigator = () => {
    return (
        <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Categories" component={CategoriesScreen} />
            <Tab.Screen name="Search" component={SearchScreen} />
            <Tab.Screen name="Cart" component={CheckoutScreen} />
            <Tab.Screen name="Account" component={ProfileScreen} />
        </Tab.Navigator>
    );
};

// Main App Navigator
const AppNavigator = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="OTP" component={OTPScreen} />
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Category" component={CategoryScreen} />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
            <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
            <Stack.Screen name="OrdersHistory" component={OrdersHistoryScreen} />
            <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
            <Stack.Screen name="Location" component={LocationScreen} />
            <Stack.Screen name="AddAddress" component={AddAddressScreen} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} />
        </Stack.Navigator>
    );
};



const styles = StyleSheet.create({
    tabBarWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
        paddingHorizontal: 12,
        paddingBottom: 10,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 12,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    iconContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    tabContentPillActive: {
        backgroundColor: '#F3E8FF',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 1.5,
        borderColor: COLORS.white,
    },
    badgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '800',
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    tabLabelActive: {
        color: '#6C3CF4',
        fontWeight: '800',
    },
});

export default AppNavigator;

