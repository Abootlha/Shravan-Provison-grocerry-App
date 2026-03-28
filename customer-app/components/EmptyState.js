import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants';

const EMPTY_STATES = {
    cart: {
        icon: 'cart-off',
        title: 'Your cart is empty',
        subtitle: 'Looks like you have not added anything to your cart yet',
        action: 'Start Shopping',
    },
    orders: {
        icon: 'package-variant',
        title: 'No orders yet',
        subtitle: 'Your order history will appear here once you place your first order',
        action: 'Browse Products',
    },
    search: {
        icon: 'magnify-close',
        title: 'No results found',
        subtitle: 'Try searching with different keywords or browse our categories',
        action: null,
    },
    favorites: {
        icon: 'heart-off-outline',
        title: 'No favorites yet',
        subtitle: 'Items you like will appear here',
        action: 'Explore Products',
    },
    address: {
        icon: 'map-marker-off-outline',
        title: 'No saved addresses',
        subtitle: 'Add an address to get faster checkout',
        action: 'Add Address',
    },
    network: {
        icon: 'wifi-off',
        title: 'No internet connection',
        subtitle: 'Please check your connection and try again',
        action: 'Retry',
    },
};

const EmptyState = ({
    type = 'cart',
    icon,
    title,
    subtitle,
    actionLabel,
    onAction,
    iconSize = 72,
}) => {
    const preset = EMPTY_STATES[type] || EMPTY_STATES.cart;

    return (
        <View style={styles.container}>
            <View style={styles.iconWrapper}>
                <MaterialCommunityIcons
                    name={icon || preset.icon}
                    size={iconSize}
                    color={COLORS.border}
                />
            </View>
            <Text style={styles.title}>{title || preset.title}</Text>
            <Text style={styles.subtitle}>{subtitle || preset.subtitle}</Text>
            {(actionLabel || preset.action) && onAction && (
                <TouchableOpacity style={styles.actionButton} onPress={onAction} activeOpacity={0.8}>
                    <Text style={styles.actionText}>{actionLabel || preset.action}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.white} />
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
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    iconWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 21,
        maxWidth: 280,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.secondary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 28,
        marginTop: 28,
        gap: 8,
    },
    actionText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.white,
    },
});

export default EmptyState;
