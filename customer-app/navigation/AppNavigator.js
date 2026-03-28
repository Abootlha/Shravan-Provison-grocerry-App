import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useTranslation } from '../hooks/useTranslation';

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
    CartScreen,
    CheckoutScreen,
    OrderTrackingScreen,
    ProfileScreen,
    OrdersHistoryScreen,
    LocationScreen,
    AddAddressScreen,
} from '../screens';
import LanguageSelectionScreen from '../screens/LanguageSelectionScreen';
import { COLORS } from '../constants';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


// Custom Tab Bar
const CustomTabBar = ({ state, descriptors, navigation }) => {
    const totalItems = useSelector((s) => s.cart.totalItems);
    const { t } = useTranslation();

    const tabLabels = {
        Home: t('home'),
        Categories: t('categories'),
        Search: t('search'),
        Cart: t('cart'),
        Account: t('account'),
    };

    return (
        <View style={styles.tabBar}>
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const isFocused = state.index === index;

                const iconMap = {
                    Home: 'home',
                    Categories: 'view-grid',
                    Search: 'magnify',
                    Cart: 'cart',
                    Account: 'account',
                };

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
                    >
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons
                                name={isFocused ? iconMap[route.name] : `${iconMap[route.name]}-outline`}
                                size={24}
                                color={isFocused ? COLORS.secondary : COLORS.textSecondary}
                            />
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
            <Tab.Screen name="Cart" component={CartScreen} />
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
            <Stack.Screen name="OrdersHistory" component={OrdersHistoryScreen} />
            <Stack.Screen name="Location" component={LocationScreen} />
            <Stack.Screen name="AddAddress" component={AddAddressScreen} />
        </Stack.Navigator>
    );
};



const styles = StyleSheet.create({
    tabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        paddingVertical: 8,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        shadowColor: COLORS.black,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 10,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 8,
    },
    iconContainer: {
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: COLORS.secondary,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '700',
    },
    tabLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    tabLabelActive: {
        color: COLORS.secondary,
        fontWeight: '600',
    },
});

export default AppNavigator;
