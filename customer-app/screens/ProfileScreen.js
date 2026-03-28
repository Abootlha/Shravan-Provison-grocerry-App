import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS } from '../constants';
import { logout } from '../store/slices/authSlice';
import { AuthService } from '../services';
import { useTranslation } from '../hooks/useTranslation';

const ProfileScreen = ({ navigation }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { isAuthenticated, user } = useSelector((state) => state.auth);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        performLogout();
    };

    const performLogout = async () => {
        setIsLoggingOut(true);

        try {
            const refreshToken = await AsyncStorage.getItem('customerRefreshToken');
            await AuthService.logout(refreshToken || undefined);
        } catch (error) {
            console.log('Logout API error (proceeding anyway):', error.message);
        }

        await AsyncStorage.multiRemove(['customerUser', 'customerAccessToken', 'customerRefreshToken']);

        // Clear Redux state
        dispatch(logout());

        setIsLoggingOut(false);

        // Navigate to Login screen
        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            })
        );
    };

    const menuSections = [
        {
            title: t('myAccount'),
            items: [
                { id: '1', icon: 'package-variant', title: t('myOrders'), subtitle: t('viewOrderHistory'), onPress: () => navigation.navigate('OrdersHistory'), badge: null },
                { id: '2', icon: 'map-marker-outline', title: t('savedAddresses'), subtitle: t('manageDeliveryAddresses'), onPress: () => { }, badge: null },
                { id: '3', icon: 'wallet-outline', title: t('wallet'), subtitle: `${t('balance')}: ₹0`, onPress: () => { }, badge: null },
            ],
        },
        {
            title: t('offersRewards'),
            items: [
                { id: '4', icon: 'ticket-percent-outline', title: t('coupons'), subtitle: t('availableOffers'), onPress: () => { }, badge: '3' },
                { id: '5', icon: 'heart-outline', title: t('wishlist'), subtitle: t('yourSavedItems'), onPress: () => { }, badge: null },
                { id: '6', icon: 'gift-outline', title: t('referEarn'), subtitle: t('getReferral'), onPress: () => { }, badge: 'NEW' },
            ],
        },
        {
            title: t('settings'),
            items: [
                { id: '7', icon: 'bell-outline', title: t('notifications'), subtitle: t('manageAlerts'), onPress: () => { }, badge: null },
                { id: '8', icon: 'shield-check-outline', title: t('privacySecurity'), subtitle: t('dataPermissions'), onPress: () => { }, badge: null },
            ],
        },
        {
            title: t('helpInfo'),
            items: [
                { id: '9', icon: 'headset', title: t('helpCenter'), subtitle: t('support247'), onPress: () => { }, badge: null },
                { id: '10', icon: 'information-outline', title: t('about'), subtitle: t('termsPolicies'), onPress: () => { }, badge: null },
            ],
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.primary} />

            {/* Profile Header */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <View style={styles.avatar}>
                        <MaterialCommunityIcons name="account" size={36} color={COLORS.white} />
                    </View>
                    <View style={styles.profileText}>
                        <Text style={styles.name}>
                            {isAuthenticated && user ? user.name : t('guestUser')}
                        </Text>
                        <View style={styles.phoneRow}>
                            <MaterialCommunityIcons name="phone" size={14} color={COLORS.textSecondary} />
                            <Text style={styles.phone}>
                                {isAuthenticated && user ? user.phone : '+91 XXXXX XXXXX'}
                            </Text>
                        </View>
                    </View>
                    {isAuthenticated ? (
                        <TouchableOpacity style={styles.editButton}>
                            <MaterialCommunityIcons name="pencil-outline" size={18} color={COLORS.text} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.loginButton}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.loginButtonText}>{t('login')}</Text>
                        </TouchableOpacity>
                    )}
                </View>


                {/* Membership Banner */}
                <View style={styles.membershipBanner}>
                    <View style={styles.membershipLeft}>
                        <MaterialCommunityIcons name="crown" size={20} color="#FFB300" />
                        <View style={styles.membershipText}>
                            <Text style={styles.membershipTitle}>{t('upgradeToPremium')}</Text>
                            <Text style={styles.membershipSubtitle}>{t('freeDeliveryAllOrders')}</Text>
                        </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
                </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>5</Text>
                    <Text style={styles.statLabel}>{t('orders')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>₹0</Text>
                    <Text style={styles.statLabel}>{t('wallet')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>3</Text>
                    <Text style={styles.statLabel}>{t('coupons')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>{t('wishlist')}</Text>
                </View>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {menuSections.map((section) => (
                    <View key={section.title} style={styles.menuSection}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                        <View style={styles.menuCard}>
                            {section.items.map((item, index) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.menuItem,
                                        index < section.items.length - 1 && styles.menuItemBorder
                                    ]}
                                    onPress={item.onPress}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.menuLeft}>
                                        <View style={styles.menuIconWrapper}>
                                            <MaterialCommunityIcons name={item.icon} size={20} color={COLORS.secondary} />
                                        </View>
                                        <View style={styles.menuTextWrapper}>
                                            <Text style={styles.menuTitle}>{item.title}</Text>
                                            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.menuRight}>
                                        {item.badge && (
                                            <View style={[styles.badge, item.badge === 'NEW' && styles.badgeNew]}>
                                                <Text style={[styles.badgeText, item.badge === 'NEW' && styles.badgeTextNew]}>
                                                    {item.badge}
                                                </Text>
                                            </View>
                                        )}
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textLight} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

                {/* Logout Button */}
                {isAuthenticated && (
                    <TouchableOpacity
                        style={styles.logoutButton}
                        activeOpacity={0.8}
                        onPress={handleLogout}
                        disabled={isLoggingOut}
                    >
                        {isLoggingOut ? (
                            <ActivityIndicator size="small" color={COLORS.error} />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
                                <Text style={styles.logoutText}>{t('logout')}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {/* App Version */}
                <View style={styles.versionContainer}>
                    <Text style={styles.version}>ShravanKirana v1.0.0</Text>
                    <Text style={styles.versionSubtext}>{t('madeWithLove')}</Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        padding: 20,
        paddingBottom: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileText: {
        flex: 1,
        marginLeft: 14,
    },
    name: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 6,
    },
    phone: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    editButton: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginButton: {
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    loginButtonText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '700',
    },
    membershipBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.5)',
        padding: 14,
        borderRadius: 14,
        marginTop: 16,
    },
    membershipLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    membershipText: {},
    membershipTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    membershipSubtitle: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.white,
        paddingVertical: 18,
        ...SHADOWS.light,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 4,
        fontWeight: '500',
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: COLORS.border,
    },
    scrollView: {
        flex: 1,
    },
    menuSection: {
        marginTop: 20,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    menuCard: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        ...SHADOWS.light,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    menuLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#E8F5E9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuTextWrapper: {
        marginLeft: 12,
        flex: 1,
    },
    menuTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    menuSubtitle: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    menuRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badge: {
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    badgeNew: {
        backgroundColor: '#FFE0B2',
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.white,
    },
    badgeTextNew: {
        color: '#E65100',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEE2E2',
        padding: 14,
        marginHorizontal: 16,
        marginTop: 24,
        borderRadius: 14,
        gap: 10,
    },
    logoutText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.error,
    },
    versionContainer: {
        alignItems: 'center',
        marginTop: 28,
    },
    version: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    versionSubtext: {
        fontSize: 11,
        color: COLORS.textLight,
        marginTop: 4,
    },
});

export default ProfileScreen;
