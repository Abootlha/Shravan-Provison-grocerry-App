import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
    Image,
    ImageBackground,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    Notification01Icon,
    Settings01Icon,
    CrownIcon,
    ShoppingBag01Icon,
    Tag01Icon,
    FavouriteIcon,
    Location01Icon,
    CreditCardIcon,
    GiftIcon,
    CustomerService01Icon,
    StarIcon,
    Shield01Icon,
    ArrowRight01Icon,
    ArrowLeft01Icon,
    Logout01Icon,
} from 'hugeicons-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logout, updateUser } from '../store/slices/authSlice';
import { AuthService, UserService, OrderService } from '../services';
import { useTranslation } from '../hooks/useTranslation';

const ProfileScreen = ({ navigation }) => {
    const insets = useSafeAreaInsets();
    const { t, isHi } = useTranslation();
    const dispatch = useDispatch();
    const { isAuthenticated, user } = useSelector((state) => state.auth);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [addressCount, setAddressCount] = useState(user?.addresses?.length || 0);

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

    const userName = isAuthenticated && user?.name ? user.name : (isHi ? 'अमित' : 'Amit');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F3E8FF" />

            {/* STICKY TOP HEADER */}
            <View style={[styles.stickyHeader, { paddingTop: Math.max(insets.top, 10) }]}>
                <View style={styles.headerRow}>
                    {/* Back Button */}
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))}
                        activeOpacity={0.75}
                    >
                        <ArrowLeft01Icon size={18} color="#1E1B4B" strokeWidth={2.2} />
                    </TouchableOpacity>

                    {/* Avatar & User Info Touchable */}
                    <TouchableOpacity
                        style={styles.userInfoRow}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('ProfileSettings')}
                    >
                        <View style={styles.avatarWrapper}>
                            {user?.profilePicture || user?.avatar || user?.photo ? (
                                <Image
                                    source={{ uri: user.profilePicture || user.avatar || user.photo }}
                                    style={styles.avatarImage}
                                />
                            ) : (
                                <Image
                                    source={require('../assets/default-avatar.png')}
                                    style={styles.avatarImage}
                                />
                            )}
                        </View>

                        {/* User Greeting Text */}
                        <View style={styles.greetingTextContainer}>
                            <Text style={styles.greetingTitle} numberOfLines={1}>
                                {isHi ? `नमस्ते, ${userName} 👋` : `Hello, ${userName} 👋`}
                            </Text>
                            <Text style={styles.greetingSubtext} numberOfLines={1}>
                                {isHi ? 'श्रवण किराना में आपका स्वागत है' : 'Welcome to Shravan Kirana'}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Top Right Action Icons */}
                    <View style={styles.topActionsRow}>
                        <TouchableOpacity style={styles.actionIconBtn} activeOpacity={0.75}>
                            <Notification01Icon size={18} color="#1E1B4B" strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionIconBtn}
                            activeOpacity={0.75}
                            onPress={() => navigation.navigate('ProfileSettings')}
                        >
                            <Settings01Icon size={18} color="#1E1B4B" strokeWidth={2} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingBottom: 40,
                }}
            >
                <View style={styles.mainContentSheet}>

                {/* 2. SHRAVAN ONE MEMBERSHIP CARD */}
                <TouchableOpacity style={styles.membershipCard} activeOpacity={0.9}>
                    <View style={styles.membershipLeft}>
                        <View style={styles.crownCircle}>
                            <CrownIcon size={20} color="#FFFFFF" strokeWidth={2.3} />
                        </View>
                        <View style={styles.membershipTextGroup}>
                            <View style={styles.membershipTitleRow}>
                                <Text style={styles.membershipTitleWhite}>Shravan </Text>
                                <Text style={styles.membershipTitleGold}>One</Text>
                            </View>
                            <Text style={styles.membershipDesc}>
                                {isHi
                                    ? 'मुफ्त डिलीवरी, विशेष ऑफर और अधिक लाभ'
                                    : 'Free delivery, exclusive offers & more benefits'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.viewBenefitsBtn}>
                        <Text style={styles.viewBenefitsText}>
                            {isHi ? 'लाभ देखें' : 'View Benefits'}
                        </Text>
                        <MaterialCommunityIcons name="chevron-right" size={16} color="#6C3CF4" />
                    </View>
                </TouchableOpacity>

                {/* 3. QUICK STATS ROW */}
                <View style={styles.statsCardContainer}>
                    {/* Orders Stat */}
                    <TouchableOpacity
                        style={styles.statBox}
                        activeOpacity={0.75}
                        onPress={() => navigation.navigate('OrdersHistory')}
                    >
                        <View style={[styles.statIconCircle, { backgroundColor: '#F3E8FF' }]}>
                            <ShoppingBag01Icon size={18} color="#7C3AED" strokeWidth={2.1} />
                        </View>
                        <Text style={styles.statNumber}>28</Text>
                        <Text style={styles.statLabel}>{isHi ? 'ऑर्डर' : 'Orders'}</Text>
                    </TouchableOpacity>

                    {/* Savings Stat */}
                    <View style={styles.statBox}>
                        <View style={[styles.statIconCircle, { backgroundColor: '#F3E8FF' }]}>
                            <Tag01Icon size={18} color="#7C3AED" strokeWidth={2.1} />
                        </View>
                        <Text style={styles.statNumber}>₹1,248</Text>
                        <Text style={styles.statLabel}>{isHi ? 'बचत' : 'Savings'}</Text>
                    </View>

                    {/* Favourites Stat */}
                    <View style={styles.statBox}>
                        <View style={[styles.statIconCircle, { backgroundColor: '#F3E8FF' }]}>
                            <FavouriteIcon size={18} color="#7C3AED" strokeWidth={2.1} />
                        </View>
                        <Text style={styles.statNumber}>12</Text>
                        <Text style={styles.statLabel}>{isHi ? 'पसंदीदा' : 'Favourites'}</Text>
                    </View>

                    {/* Addresses Stat */}
                    <View style={styles.statBox}>
                        <View style={[styles.statIconCircle, { backgroundColor: '#F3E8FF' }]}>
                            <Location01Icon size={18} color="#7C3AED" strokeWidth={2.1} />
                        </View>
                        <Text style={styles.statNumber}>{addressCount || user?.addresses?.length || 0}</Text>
                        <Text style={styles.statLabel}>{isHi ? 'पते' : 'Addresses'}</Text>
                    </View>
                </View>

                {/* 4. SECTION: ACCOUNT */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeaderTitle}>{isHi ? 'खाता' : 'Account'}</Text>
                    <View style={styles.menuGroupCard}>
                        {/* My Addresses */}
                        <TouchableOpacity style={styles.menuRowItem} activeOpacity={0.7}>
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#DCFCE7' }]}>
                                    <Location01Icon size={18} color="#16A34A" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'सहेजे गए पते' : 'My Addresses'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'अपने सहेजे गए पते प्रबंधित करें' : 'Manage your saved addresses'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        {/* Payment Methods */}
                        <TouchableOpacity style={styles.menuRowItem} activeOpacity={0.7}>
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#F3E8FF' }]}>
                                    <CreditCardIcon size={18} color="#7C3AED" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'भुगतान के तरीके' : 'Payment Methods'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'यूपीआई, कार्ड, वॉलेट और अन्य' : 'UPI, Cards, Wallets & more'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        {/* Profile Settings */}
                        <TouchableOpacity
                            style={styles.menuRowItem}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('ProfileSettings')}
                        >
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#F3E8FF' }]}>
                                    <Settings01Icon size={18} color="#6C3CF4" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'प्रोफ़ाइल सेटिंग्स' : 'Profile Settings'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'नाम, फ़ोटो और विवरण प्रबंधित करें' : 'Manage name, photo & details'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        {/* My Orders */}
                        <TouchableOpacity
                            style={styles.menuRowItem}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('OrdersHistory')}
                        >
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#FFEDD5' }]}>
                                    <ShoppingBag01Icon size={18} color="#EA580C" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'मेरे ऑर्डर' : 'My Orders'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'अपने ऑर्डर देखें और ट्रैक करें' : 'View and track your orders'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        {/* My Favourites */}
                        <TouchableOpacity style={styles.menuRowItem} activeOpacity={0.7}>
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#FCE7F3' }]}>
                                    <FavouriteIcon size={18} color="#DB2777" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'मेरे पसंदीदा' : 'My Favourites'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'आपके पसंदीदा उत्पाद' : 'Your favourite products'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        {/* Shravan One */}
                        <TouchableOpacity style={styles.menuRowItem} activeOpacity={0.7}>
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#EDE9FE' }]}>
                                    <CrownIcon size={18} color="#6D28D9" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>Shravan One</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'सदस्यता और लाभ' : 'Membership and benefits'}</Text>
                                </View>
                            </View>
                            <View style={styles.rightSideWithBadge}>
                                <View style={styles.newBadgePill}>
                                    <Text style={styles.newBadgeText}>New</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 5. SECTION: MORE */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeaderTitle}>{isHi ? 'अधिक' : 'More'}</Text>
                    <View style={styles.menuGroupCard}>
                        {/* Refer & Earn */}
                        <TouchableOpacity style={styles.menuRowItem} activeOpacity={0.7}>
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#DCFCE7' }]}>
                                    <GiftIcon size={18} color="#16A34A" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'रेफर करें और कमाएं' : 'Refer & Earn'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'दोस्तों को आमंत्रित करें और पुरस्कार पाएं' : 'Invite friends & earn rewards'}</Text>
                                </View>
                            </View>
                            <View style={styles.rightSideWithBadge}>
                                <View style={styles.earnBadgePill}>
                                    <Text style={styles.earnBadgeText}>{isHi ? '₹150 पाएं' : 'Earn ₹150'}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        {/* Help & Support */}
                        <TouchableOpacity style={styles.menuRowItem} activeOpacity={0.7}>
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#E0F2FE' }]}>
                                    <CustomerService01Icon size={18} color="#0284C7" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'सहायता और समर्थन' : 'Help & Support'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'सामान्य प्रश्न, चैट और कॉल सहायता' : 'FAQs, chat & call support'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        {/* Rate Shravan Kirana */}
                        <TouchableOpacity style={styles.menuRowItem} activeOpacity={0.7}>
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#FEF3C7' }]}>
                                    <StarIcon size={18} color="#D97706" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'श्रवण किराना को रेट करें' : 'Rate Shravan Kirana'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'अपनी प्रतिक्रिया साझा करें' : 'Share your feedback'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <View style={styles.itemDivider} />

                        {/* Privacy Policy */}
                        <TouchableOpacity style={styles.menuRowItem} activeOpacity={0.7}>
                            <View style={styles.menuLeftContent}>
                                <View style={[styles.menuIconBg, { backgroundColor: '#F3E8FF' }]}>
                                    <Shield01Icon size={18} color="#7C3AED" strokeWidth={2.2} />
                                </View>
                                <View style={styles.menuTextGroup}>
                                    <Text style={styles.menuMainTitle}>{isHi ? 'गोपनीयता नीति' : 'Privacy Policy'}</Text>
                                    <Text style={styles.menuSubTitle}>{isHi ? 'जानें कि हम आपकी सुरक्षा कैसे करते हैं' : 'Know how we protect you'}</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 6. BOTTOM PROMO BANNER */}
                <TouchableOpacity style={styles.promoBannerTouchable} activeOpacity={0.9}>
                    <ImageBackground
                        source={require('../assets/profile-offer-card.png')}
                        style={styles.promoBannerCardBg}
                        imageStyle={{ borderRadius: 20, resizeMode: 'cover' }}
                    >
                        <View style={styles.promoTextContent}>
                            <Text style={styles.promoBannerTitle}>
                                {isHi ? 'अपने अगले 3 ऑर्डर पर\nमुफ्त डिलीवरी पाएं' : 'Get free delivery on\nyour next 3 orders'}
                            </Text>
                            <View style={styles.joinShravanRow}>
                                <Text style={styles.promoBannerSubtext}>
                                    {isHi ? 'अभी Shravan One से जुड़ें' : 'Join Shravan One now'}
                                </Text>
                                <View style={styles.arrowCirclePill}>
                                    <ArrowRight01Icon size={12} color="#FFFFFF" strokeWidth={2.5} />
                                </View>
                            </View>
                        </View>
                    </ImageBackground>
                </TouchableOpacity>

                {/* 7. LOGOUT BUTTON (IF AUTHENTICATED) */}
                {isAuthenticated && (
                    <TouchableOpacity
                        style={styles.logoutBtn}
                        activeOpacity={0.8}
                        onPress={handleLogout}
                        disabled={isLoggingOut}
                    >
                        {isLoggingOut ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                            <>
                                <Logout01Icon size={18} color="#EF4444" strokeWidth={2.2} />
                                <Text style={styles.logoutText}>{isHi ? 'लॉगआउट करें' : 'Logout'}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {/* APP VERSION */}
                <View style={styles.versionWrapper}>
                    <Text style={styles.versionText}>Shravan Kirana v1.0.0</Text>
                    <Text style={styles.versionSubtext}>Made with ❤️ for instant delivery</Text>
                </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3E8FF',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#F3E8FF',
    },
    mainContentSheet: {
        backgroundColor: '#FAF7FD',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        paddingTop: 18,
        minHeight: 800,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
    },
    /* HEADER STYLES */
    stickyHeader: {
        backgroundColor: '#F3E8FF',
        zIndex: 100,
        paddingBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        width: '100%',
    },
    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    avatarWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3E8FF',
        borderWidth: 2,
        borderColor: '#E9D5FF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
        resizeMode: 'cover',
    },
    avatarCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#EDE9FE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    greetingTextContainer: {
        marginLeft: 10,
        flex: 1,
        justifyContent: 'center',
    },
    greetingTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
        letterSpacing: -0.3,
    },
    greetingSubtext: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '500',
        marginTop: 1,
    },
    brandSubtext: {
        fontSize: 12,
        color: '#7C3AED',
        fontWeight: '800',
        marginTop: -1,
    },
    topActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',

        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },

    /* MEMBERSHIP CARD STYLES */
    membershipCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#6C3CF4',
        marginHorizontal: 16,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,

        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 5,
    },
    membershipLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    crownCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    membershipTextGroup: {
        marginLeft: 12,
        flex: 1,
    },
    membershipTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    membershipTitleWhite: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    membershipTitleGold: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FBBF24',
    },
    membershipDesc: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.85)',
        fontWeight: '500',
        marginTop: 2,
    },
    viewBenefitsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    viewBenefitsText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6C3CF4',
        marginRight: 2,
    },

    /* QUICK STATS ROW STYLES */
    statsCardContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        marginHorizontal: 16,
        borderRadius: 20,
        paddingVertical: 14,
        paddingHorizontal: 6,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F3E8FF',

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    statNumber: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    statLabel: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '500',
        marginTop: 2,
    },

    /* SECTION & MENU STYLES */
    sectionContainer: {
        marginHorizontal: 16,
        marginBottom: 20,
    },
    sectionHeaderTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 10,
        letterSpacing: -0.2,
    },
    menuGroupCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F3E8FF',
        overflow: 'hidden',

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    menuRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    itemDivider: {
        height: 1,
        backgroundColor: '#F8F5FF',
        marginLeft: 62,
    },
    menuLeftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuIconBg: {
        width: 38,
        height: 38,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuTextGroup: {
        marginLeft: 12,
        flex: 1,
    },
    menuMainTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    menuSubTitle: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '500',
        marginTop: 2,
    },
    rightSideWithBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    newBadgePill: {
        backgroundColor: '#F3E8FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    newBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#7C3AED',
    },
    earnBadgePill: {
        backgroundColor: '#F3E8FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    earnBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#7C3AED',
    },

    /* BOTTOM PROMO BANNER */
    promoBannerTouchable: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,

        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    promoBannerCardBg: {
        width: '100%',
        height: 145,
        borderRadius: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        paddingLeft: 22,
        paddingRight: 10,
        paddingVertical: 16,
    },
    promoTextContent: {
        maxWidth: '65%',
    },
    promoBannerTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E1B4B',
        lineHeight: 22,
        letterSpacing: -0.3,
    },
    joinShravanRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 6,
    },
    promoBannerSubtext: {
        fontSize: 13,
        fontWeight: '700',
        color: '#7C3AED',
    },
    arrowCirclePill: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#7C3AED',
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* LOGOUT BUTTON */
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        marginHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
        marginBottom: 16,
    },
    logoutText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#EF4444',
    },
    versionWrapper: {
        alignItems: 'center',
        marginTop: 8,
    },
    versionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#9CA3AF',
    },
    versionSubtext: {
        fontSize: 11,
        color: '#D1D5DB',
        marginTop: 2,
    },
});

export default ProfileScreen;
