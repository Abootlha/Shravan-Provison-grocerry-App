/**
 * ProfileScreen (Account tab) — Part C §11, DESIGN.md.
 *   · Canvas screen; a large "Account" title collapses into the solid surface bar on scroll.
 *   · Identity card: flat surface + hairline, initials avatar circle on the brand tint, name, phone,
 *     email and an outline "Edit" button. Real counts (orders · addresses · wishlist) are row values.
 *   · Grouped lists with plain line glyphs (inkSecondary) and inset hairlines; "Log out" is a danger row.
 *   · Bottom padding clears the floating dock (useTabBarHeight: dock + lift + safe area).
 *   · Preferences → Appearance: System / Light / Dark (ThemeModeControl); the switch cross-fades the
 *     palette (profile/ThemeCrossfade) instead of cutting.
 * Motion: rows press with PressableHighlight; a language change cross-fades the list copy; the tab body
 * replays a short crossfade + rise when you switch back to this tab (AnimatedScreen replayOnFocus). Nothing loops.
 */
import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { useSelector, useDispatch } from 'react-redux';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import {
    AnimatedScreen,
    Button,
    Card,
    CollapsibleHeader,
    ContentSwap,
    LargeTitle,
    Screen,
    Text,
    ThemeModeControl,
    toast,
    useCollapsibleHeader,
    useCollapsibleHeaderHeight,
} from '../components/ui';
import { logout, updateUser } from '../store/slices/authSlice';
import { AuthService, OrderService, SettingsService, UserService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { SettingsBlock, SettingsGroup, SettingsRow } from './profile/SettingsRow';
import { useThemeCrossfade } from './profile/ThemeCrossfade';
import { initialsOf } from './orders/orderUtils';
import { useTabBarHeight } from '../components/BottomTabsIcons';

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

const formatPhone = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '').slice(-10);
    return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : raw || '';
};

const ProfileScreen = ({ navigation }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const xfade = useThemeCrossfade();
    const dockHeight = useTabBarHeight();
    const collapse = useCollapsibleHeader();
    const top = useCollapsibleHeaderHeight();
    const { isHi } = useTranslation();
    const dispatch = useDispatch();
    const { isAuthenticated, user } = useSelector((state) => state.auth);
    const wishlistCount = useSelector((state) => state.wishlist?.items?.length || 0);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [addressCount, setAddressCount] = useState(user?.addresses?.length || 0);
    const [orderCount, setOrderCount] = useState(null);

    React.useEffect(() => {
        const unsubscribe = navigation.addListener('focus', async () => {
            if (isAuthenticated) {
                try {
                    const profile = await UserService.getProfile();
                    if (profile) {
                        dispatch(updateUser({ ...user, ...profile }));
                        if (profile.addresses) {
                            setAddressCount(profile.addresses.length);
                        }
                    }
                } catch (err) {
                    if (__DEV__) console.log('Error fetching user profile in ProfileScreen:', err);
                }
            }
        });
        return unsubscribe;
    }, [navigation, isAuthenticated]);

    // Real order count for the hero strip (hidden until it loads; never a placeholder number).
    useFocusEffect(
        useCallback(() => {
            let active = true;
            if (isAuthenticated && user?.id) {
                OrderService.getOrders(user.id)
                    .then((res) => {
                        const list = Array.isArray(res) ? res : res?.orders || [];
                        if (active) setOrderCount(list.length);
                    })
                    .catch(() => {});
            }
            return () => {
                active = false;
            };
        }, [isAuthenticated, user?.id])
    );

    const handleLogout = async () => {
        setIsLoggingOut(true);

        try {
            // Calls /auth/logout, then clears stored tokens even if the call fails.
            await AuthService.logout();
        } catch (error) {
            if (__DEV__) console.log('Logout API error (proceeding anyway):', error.message);
        }

        dispatch(logout());
        setIsLoggingOut(false);

        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            })
        );
    };

    const handleHelp = async () => {
        try {
            const data = await SettingsService.getStoreSettings();
            const phone = (data?.settings || data)?.contactPhone;
            if (phone) {
                Linking.openURL(`tel:${phone}`);
                return;
            }
        } catch (e) {
            // fall through to the toast
        }
        toast.info(isHi ? 'सहायता जल्द उपलब्ध होगी' : 'Support will be available shortly');
    };

    const soon = () => toast.info(isHi ? 'जल्द आ रहा है' : 'Coming soon');

    const userName = isAuthenticated && user?.name ? user.name : isHi ? 'मेहमान' : 'Guest';
    const photo = user?.profilePicture || user?.avatar || user?.photo;
    const phone = formatPhone(user?.phone || user?.mobile || user?.phoneNumber);
    // As the Account tab this is a root screen: no back arrow. (Pushed onto a stack it gets one.)
    const isTabRoot = navigation.getState?.()?.type === 'tab';
    const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));
    const editProfile = () => navigation.navigate('ProfileSettings');
    const bottomPad = dockHeight + space['2xl'];
    const title = isHi ? 'खाता' : 'Account';

    return (
        <Screen edges={[]}>
            <AnimatedScreen replayOnFocus>
            <Animated.ScrollView
                onScroll={collapse.onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: top, paddingBottom: bottomPad }}
            >
                <LargeTitle collapse={collapse} title={title} />

                <ContentSwap stateKey={isHi ? 'hi' : 'en'}>
                <View style={styles.content}>
                    <Card padding="lg" style={styles.identity}>
                        <View style={styles.avatar}>
                            {photo ? (
                                <Image source={{ uri: photo }} style={styles.avatarImg} contentFit="cover" transition={150} />
                            ) : (
                                <Text variant="h2" color={colors.brandStrong}>{initialsOf(userName)}</Text>
                            )}
                        </View>
                        <View style={styles.identityText}>
                            <Text variant="h3" numberOfLines={1}>{userName}</Text>
                            {phone ? <Text variant="body" color="secondary" tabular>{phone}</Text> : null}
                            {user?.email ? <Text variant="caption" color="muted" numberOfLines={1}>{user.email}</Text> : null}
                        </View>
                        {isAuthenticated ? (
                            <Button
                                variant="outline"
                                size="sm"
                                label={isHi ? 'बदलें' : 'Edit'}
                                onPress={editProfile}
                                accessibilityLabel={isHi ? 'प्रोफ़ाइल बदलें' : 'Edit profile'}
                            />
                        ) : (
                            <Button size="sm" label={isHi ? 'लॉग इन' : 'Log in'} onPress={() => navigation.navigate('Login')} />
                        )}
                    </Card>

                    <SettingsGroup title={isHi ? 'आपका खाता' : 'Your account'}>
                        <SettingsRow
                            icon="shopping-outline"
                            title={isHi ? 'मेरे ऑर्डर' : 'My orders'}
                            subtitle={isHi ? 'ट्रैक करें, फिर से मँगाएँ' : 'Track, reorder, get receipts'}
                            value={orderCount ? String(orderCount) : undefined}
                            onPress={() => navigation.navigate('OrdersHistory')}
                        />
                        <SettingsRow
                            icon="map-marker-outline"
                            title={isHi ? 'सहेजे गए पते' : 'Saved addresses'}
                            value={addressCount ? String(addressCount) : undefined}
                            onPress={() => navigation.navigate('Location')}
                        />
                        <SettingsRow
                            icon="heart-outline"
                            title={isHi ? 'मेरी विशलिस्ट' : 'Wishlist'}
                            value={wishlistCount ? String(wishlistCount) : undefined}
                            onPress={() => navigation.navigate('Wishlist')}
                        />
                    </SettingsGroup>

                    <SettingsGroup title={isHi ? 'पसंद' : 'Preferences'}>
                        <SettingsRow
                            icon="translate"
                            title={isHi ? 'भाषा' : 'Language'}
                            value={isHi ? 'हिंदी' : 'English'}
                            onPress={() => navigation.navigate('LanguageSelection', { fromSettings: true })}
                        />
                        <SettingsBlock
                            icon="theme-light-dark"
                            title={isHi ? 'दिखावट' : 'Appearance'}
                            subtitle={isHi ? 'सिस्टम के साथ, या हमेशा लाइट / डार्क' : 'Follow the system, or always light or dark'}
                        >
                            <View {...xfade.armProps}>
                                <ThemeModeControl
                                    labels={{
                                        system: isHi ? 'सिस्टम' : 'System',
                                        light: isHi ? 'लाइट' : 'Light',
                                        dark: isHi ? 'डार्क' : 'Dark',
                                        title: isHi ? 'दिखावट' : 'Appearance',
                                    }}
                                />
                            </View>
                        </SettingsBlock>
                        <SettingsRow
                            icon="bell-outline"
                            title={isHi ? 'सूचनाएँ' : 'Notifications'}
                            subtitle={isHi ? 'जल्द आ रहा है' : 'Coming soon'}
                            onPress={soon}
                        />
                    </SettingsGroup>

                    <SettingsGroup title={isHi ? 'सहायता' : 'Support'}>
                        <SettingsRow
                            icon="phone-outline"
                            title={isHi ? 'मदद और सहायता' : 'Help and support'}
                            subtitle={isHi ? 'स्टोर को सीधे कॉल करें' : 'Call the store directly'}
                            onPress={handleHelp}
                        />
                        <SettingsRow
                            icon="information-outline"
                            title={isHi ? 'ऐप के बारे में' : 'About'}
                            value={`v${APP_VERSION}`}
                            onPress={() => toast.info(`Shravan Kirana v${APP_VERSION}`)}
                        />
                    </SettingsGroup>

                    {isAuthenticated ? (
                        <SettingsGroup>
                            <SettingsRow
                                icon="logout"
                                tone="danger"
                                title={isHi ? 'लॉग आउट' : 'Log out'}
                                loading={isLoggingOut}
                                onPress={handleLogout}
                            />
                        </SettingsGroup>
                    ) : null}

                    <Text variant="caption" color="muted" align="center" style={styles.footer}>
                        {isHi ? `Shravan Kirana · संस्करण ${APP_VERSION}` : `Shravan Kirana · version ${APP_VERSION}`}
                    </Text>
                </View>
                </ContentSwap>
            </Animated.ScrollView>
            </AnimatedScreen>

            <CollapsibleHeader
                collapse={collapse}
                title={title}
                onBack={isTabRoot ? undefined : goBack}
                backLabel={isHi ? 'वापस जाएँ' : 'Go back'}
            />
            {xfade.veil}
        </Screen>
    );
};

const AVATAR = 56;

const useStyles = makeStyles((t) => ({
    content: { paddingHorizontal: space.lg, gap: space.xl },
    identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    avatar: {
        width: AVATAR,
        height: AVATAR,
        borderRadius: radii.pill, // circle
        backgroundColor: t.colors.brandTint,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImg: { width: AVATAR, height: AVATAR },
    identityText: { flex: 1, gap: space.xxs },
    footer: { paddingTop: space.xs },
}));

export default ProfileScreen;
