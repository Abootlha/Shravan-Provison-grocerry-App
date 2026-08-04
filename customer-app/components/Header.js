import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, StatusBar, Dimensions, FlatList, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
    ArrowLeft02Icon,
    Clock01Icon,
    ArrowDown01Icon,
    Wallet01Icon,
    UserIcon,
    ShoppingCart01Icon,
} from 'hugeicons-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHADOWS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CarouselBackground = ({ bgImages, bgImageStyle, bgImageResizeMode }) => {
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Append the first image at the end for a seamless infinite loop
    const loopedImages = bgImages && bgImages.length > 1 ? [...bgImages, bgImages[0]] : bgImages;

    useEffect(() => {
        if (!bgImages || bgImages.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex(prev => {
                const nextIndex = prev + 1;

                if (flatListRef.current) {
                    try {
                        flatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
                    } catch (e) {
                        console.log('Scroll error', e);
                    }
                }

                // If we just animated to the cloned first slide, secretly jump back to real first slide
                if (nextIndex === bgImages.length) {
                    setTimeout(() => {
                        if (flatListRef.current) {
                            try {
                                flatListRef.current.scrollToIndex({ index: 0, animated: false });
                            } catch (e) { }
                        }
                    }, 500); // wait for scroll animation to finish
                    return 0; // reset state index back to 0
                }

                return nextIndex;
            });
        }, 5000);

        return () => clearInterval(interval);
    }, [bgImages]);

    const getItemLayout = (data, index) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
        index,
    });

    const renderItem = ({ item }) => (
        <View style={{ width: SCREEN_WIDTH, height: '100%' }}>
            <Image
                source={item}
                style={[styles.heroBackgroundImage, bgImageStyle]}
                resizeMode={bgImageResizeMode}
            />
        </View>
    );

    return (
        <View style={StyleSheet.absoluteFill}>
            <FlatList
                ref={flatListRef}
                data={loopedImages}
                keyExtractor={(_, index) => index.toString()}
                renderItem={renderItem}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                getItemLayout={getItemLayout}
            />
        </View>
    );
};

const Header = ({
    title,
    subtitle,
    showBack,
    showLocation,
    location = 'HOME',
    addressDetail = 'Chavri Road, Market Area',
    deliveryTime = '10 minutes',
    onBackPress,
    onLocationPress,
    onProfilePress,
    onWalletPress,
    onCartPress,
    cartItems = 0,
    showProfileAndWallet = true,
    showCart = false,
    rightComponent,
    transparent = false,
    whiteBackground = false,
    renderBackground = true,
    useGradient = true,
    bgImage = null,
    bgImages,
    bgImageStyle,
    bgImageResizeMode = "cover",
    scrollY,
    children,
}) => {
    const { t } = useTranslation();

    const topContentOpacity = scrollY ? scrollY.interpolate({
        inputRange: [0, 35, 70],
        outputRange: [1, 0.2, 0],
        extrapolate: 'clamp',
    }) : 1;

    const topContentHeight = scrollY ? scrollY.interpolate({
        inputRange: [0, 70],
        outputRange: [88, 0],
        extrapolate: 'clamp',
    }) : undefined;

    const topContentTranslateY = scrollY ? scrollY.interpolate({
        inputRange: [0, 70],
        outputRange: [0, -14],
        extrapolate: 'clamp',
    }) : 0;

    const whiteOverlayOpacity = scrollY ? scrollY.interpolate({
        inputRange: [0, 40, 70],
        outputRange: [0, 0.7, 1],
        extrapolate: 'clamp',
    }) : 0;

    const headerElevation = scrollY ? scrollY.interpolate({
        inputRange: [0, 70],
        outputRange: [0, 4],
        extrapolate: 'clamp',
    }) : 0;

    if (showLocation) {
        return (
            <Animated.View
                style={[
                    styles.locationHeaderContainer,
                    transparent && styles.transparentHeader,
                    whiteBackground && styles.whiteHeader,
                    scrollY && {
                        elevation: headerElevation,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: scrollY.interpolate({
                            inputRange: [0, 70],
                            outputRange: [0, 0.08],
                            extrapolate: 'clamp',
                        }),
                        shadowRadius: 4,
                        borderBottomWidth: 0,
                    }
                ]}
            >
                {/* Background — LinearGradient or custom background image */}
                {renderBackground && (
                    bgImage ? (
                        <Image
                            source={bgImage}
                            style={[styles.heroBackgroundImage, bgImageStyle]}
                            resizeMode={bgImageResizeMode}
                        />
                    ) : bgImages && bgImages.length > 0 ? (
                        <CarouselBackground
                            bgImages={bgImages}
                            bgImageStyle={bgImageStyle}
                            bgImageResizeMode={bgImageResizeMode}
                        />
                    ) : (
                        <LinearGradient
                            colors={['#EAE0FF', '#F5EFFF', '#FAFAFC']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                        />
                    )
                )}

                {/* White background overlay that fades in when sticky */}
                {scrollY && (
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFillObject,
                            {
                                backgroundColor: COLORS.white,
                                opacity: whiteOverlayOpacity,
                            }
                        ]}
                        pointerEvents="none"
                    />
                )}

                {/* Content layer — sits above the background */}
                <View style={styles.heroContentLayer}>
                    {/* Collapsible Animated Container for Top Info */}
                    <Animated.View
                        style={[
                            styles.topContentCollapsible,
                            scrollY && {
                                opacity: topContentOpacity,
                                height: topContentHeight,
                                transform: [{ translateY: topContentTranslateY }],
                            }
                        ]}
                    >
                        {/* Top Meta: Brand Prefix & Hero Delivery Time */}
                        <View style={styles.topMetaRow}>
                            <View style={styles.brandPrefixContainer}>
                                {showBack ? (
                                    <TouchableOpacity
                                        style={styles.backIconButton}
                                        onPress={onBackPress}
                                        activeOpacity={0.75}
                                    >
                                        <ArrowLeft02Icon size={20} color={COLORS.text} strokeWidth={2} />
                                    </TouchableOpacity>
                                ) : (
                                    <View>
                                        <Text style={styles.brandPrefixText}>Shravan Kirana in</Text>
                                        <View style={styles.heroTimeRow}>
                                            <Text style={styles.heroTimeText}>{deliveryTime}</Text>
                                            <View style={styles.tag247Pill}>
                                                <Clock01Icon size={12} color="#333333" strokeWidth={2} />
                                                <Text style={styles.tag247Text}>24/7</Text>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Bottom Row: Location Selector (Left) & Profile / Wallet Actions (Right) Aligned */}
                        <View style={styles.locationAndActionsRow}>
                            <TouchableOpacity
                                style={styles.locationSelectorRow}
                                onPress={onLocationPress}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.locationTextMain} numberOfLines={1}>
                                    <Text style={styles.locationHomeBold}>{location.toUpperCase()} - </Text>
                                    <Text style={styles.locationAddressText}>{addressDetail || subtitle}</Text>
                                </Text>
                                <ArrowDown01Icon size={16} color={COLORS.text} strokeWidth={2} />
                            </TouchableOpacity>

                            <View style={styles.topActionsContainer}>
                                {showProfileAndWallet && (
                                    <>
                                        {/* Wallet Pill */}
                                        <TouchableOpacity
                                            style={styles.walletPill}
                                            onPress={onWalletPress}
                                            activeOpacity={0.8}
                                        >
                                            <Wallet01Icon size={15} color={COLORS.secondary} strokeWidth={2} />
                                            <Text style={styles.walletText}>₹0</Text>
                                        </TouchableOpacity>

                                        {/* Profile Button */}
                                        <TouchableOpacity
                                            style={styles.profileCircle}
                                            onPress={onProfilePress}
                                            activeOpacity={0.8}
                                        >
                                            <UserIcon size={20} color={COLORS.text} strokeWidth={2} />
                                        </TouchableOpacity>
                                    </>
                                )}

                                {showCart && (
                                    <TouchableOpacity
                                        style={styles.cartCircle}
                                        onPress={onCartPress}
                                        activeOpacity={0.8}
                                    >
                                        <ShoppingCart01Icon size={20} color={COLORS.text} strokeWidth={2} />
                                        {cartItems > 0 && (
                                            <View style={styles.cartBadge}>
                                                <Text style={styles.cartBadgeText}>{cartItems}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </Animated.View>

                    {/* Children slots (Search Bar / Quick Category Tabs) */}
                    {children}
                </View>
            </Animated.View>
        );
    }

    return (
        <View style={[
            styles.standardHeaderContainer,
            transparent && styles.transparentHeader,
            whiteBackground && styles.whiteHeader
        ]}>
            <LinearGradient
                colors={['#EAE0FF', '#F5EFFF', '#FAF9F6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFillObject}
            />
            {showBack && (
                <TouchableOpacity style={[styles.actionIconButton, whiteBackground && styles.borderedCard]} onPress={onBackPress} activeOpacity={0.75}>
                    <ArrowLeft02Icon
                        size={20}
                        color={COLORS.text}
                        strokeWidth={2}
                    />
                </TouchableOpacity>
            )}

            <View style={[styles.titleContainer, !showBack && styles.titleContainerNoBack]}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
            </View>

            {rightComponent && (
                <View style={styles.rightComponentWrapper}>{rightComponent}</View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    locationHeaderContainer: {
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        paddingBottom: 12,
    },
    topContentCollapsible: {
        overflow: 'hidden',
    },
    heroBackgroundImage: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH * 2.16,
    },
    heroContentLayer: {
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 54,
        paddingBottom: 0,
        position: 'relative',
        zIndex: 1,
    },
    standardHeaderContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 52,
        paddingBottom: 14,
        borderBottomWidth: 0,
        position: 'relative',
        zIndex: 10,
    },
    transparentHeader: {
        backgroundColor: 'transparent',
        borderBottomWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
    },
    whiteHeader: {
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    topMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    brandPrefixContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandPrefixText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#444444',
        opacity: 0.9,
    },
    backIconButton: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.light,
    },
    topActionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    walletPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 4,
        ...SHADOWS.light,
    },
    walletText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#111111',
    },
    profileCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.light,
    },
    cartCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.light,
        marginLeft: 8,
    },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: COLORS.primary,
        borderRadius: 10,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.white,
    },
    cartBadgeText: {
        color: COLORS.white,
        fontSize: 9,
        fontWeight: 'bold',
    },
    heroTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginVertical: 1,
    },
    heroTimeText: {
        fontSize: 26,
        fontWeight: '900',
        color: '#111111',
        letterSpacing: -0.5,
    },
    tag247Pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        gap: 3,
    },
    tag247Text: {
        fontSize: 11,
        fontWeight: '700',
        color: '#333333',
    },
    locationAndActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        marginBottom: 2,
    },
    locationSelectorRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginRight: 8,
    },
    locationTextMain: {
        flexShrink: 1,
    },
    locationHomeBold: {
        fontSize: 13,
        fontWeight: '900',
        color: '#111111',
    },
    locationAddressText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#333333',
    },
    actionIconButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        ...SHADOWS.light,
    },
    borderedCard: {
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        backgroundColor: '#F8F9FA',
    },
    rightComponentWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    titleContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    titleContainerNoBack: {
        paddingLeft: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
        fontWeight: '500',
    },
});

export default Header;
