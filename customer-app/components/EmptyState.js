import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
    ShoppingBasket01Icon,
    ArrowRight01Icon,
    SparklesIcon,
} from 'hugeicons-react-native';
import { COLORS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

const EMPTY_STATES = {
    cart: {
        titleEn: 'Your cart is empty',
        titleHi: 'आपकी कार्ट खाली है',
        subtitleEn: 'Looks like you have not added anything to your cart yet',
        subtitleHi: 'आपने अभी तक अपनी कार्ट में कोई सामान नहीं जोड़ा है',
        actionEn: 'Start Shopping',
        actionHi: 'खरीदारी शुरू करें',
    },
    orders: {
        titleEn: 'No orders yet',
        titleHi: 'कोई ऑर्डर नहीं',
        subtitleEn: 'Your order history will appear here once you place your first order',
        subtitleHi: 'ऑर्डर करने के बाद आपका इतिहास यहाँ दिखेगा',
        actionEn: 'Browse Products',
        actionHi: 'सामान देखें',
    },
    search: {
        titleEn: 'No results found',
        titleHi: 'कोई परिणाम नहीं मिला',
        subtitleEn: 'Try searching with different keywords or browse our categories',
        subtitleHi: 'अन्य शब्दों से खोजें या हमारी श्रेणियां देखें',
        actionEn: null,
        actionHi: null,
    },
    favorites: {
        titleEn: 'No favorites yet',
        titleHi: 'कोई पसंदीदा सामान नहीं',
        subtitleEn: 'Items you like will appear here',
        subtitleHi: 'आपके पसंद किए गए सामान यहाँ दिखेंगे',
        actionEn: 'Explore Products',
        actionHi: 'सामान खोजें',
    },
};

const EmptyState = ({
    type = 'cart',
    title,
    subtitle,
    actionLabel,
    onAction,
}) => {
    const { currentLanguage } = useTranslation();
    const isHi = currentLanguage === 'hi';
    const preset = EMPTY_STATES[type] || EMPTY_STATES.cart;

    const displayTitle = title || (isHi ? preset.titleHi : preset.titleEn);
    const displaySubtitle = subtitle || (isHi ? preset.subtitleHi : preset.subtitleEn);
    const displayAction = actionLabel || (isHi ? preset.actionHi : preset.actionEn);

    return (
        <View style={styles.container}>
            {/* 3D Illustration Ambient Container */}
            <View style={styles.illustrationWrapper}>
                {/* 3D Layer 1: Outer Soft Ambient Glow */}
                <View style={styles.glowOuter} />
                
                {/* 3D Layer 2: Mid Concentric Circle */}
                <View style={styles.glowMid} />
                
                {/* 3D Layer 3: Main Inner 3D Glass Sphere */}
                <View style={styles.glowInner}>
                    <ShoppingBasket01Icon size={64} color="#6C3CF4" strokeWidth={2} />
                </View>

                {/* 3D Floating Mini Badges */}
                <View style={[styles.floatingBadge, styles.badgeTopRight]}>
                    <SparklesIcon size={16} color="#FFB800" strokeWidth={2.5} />
                </View>
                <View style={[styles.floatingBadge, styles.badgeBottomLeft]}>
                    <Text style={styles.badgeText}>3D</Text>
                </View>
            </View>

            {/* Typography */}
            <Text style={styles.title}>{displayTitle}</Text>
            <Text style={styles.subtitle}>{displaySubtitle}</Text>

            {/* CTA Button */}
            {displayAction && onAction && (
                <TouchableOpacity style={styles.actionButton} onPress={onAction} activeOpacity={0.85}>
                    <Text style={styles.actionText}>{displayAction}</Text>
                    <ArrowRight01Icon size={18} color={COLORS.white} strokeWidth={2.5} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 36,
        paddingVertical: 40,
        backgroundColor: '#FAF9F6',
    },
    illustrationWrapper: {
        width: 200,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
        position: 'relative',
    },
    glowOuter: {
        position: 'absolute',
        width: 190,
        height: 190,
        borderRadius: 95,
        backgroundColor: 'rgba(108, 60, 244, 0.08)',
    },
    glowMid: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(108, 60, 244, 0.14)',
        borderWidth: 1,
        borderColor: 'rgba(108, 60, 244, 0.18)',
    },
    glowInner: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(108, 60, 244, 0.25)',
    },
    floatingBadge: {
        position: 'absolute',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 8,
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    badgeTopRight: {
        top: 20,
        right: 18,
    },
    badgeBottomLeft: {
        bottom: 24,
        left: 20,
        backgroundColor: '#F3E8FF',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#6C3CF4',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.text,
        textAlign: 'center',
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 10,
        textAlign: 'center',
        lineHeight: 21,
        maxWidth: 280,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6C3CF4',
        paddingHorizontal: 28,
        paddingVertical: 15,
        borderRadius: 30,
        marginTop: 32,
        gap: 10,
        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    actionText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.white,
    },
});

export default EmptyState;
