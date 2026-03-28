import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';
import { useTranslation } from '../hooks/useTranslation';

const Header = ({
    title,
    subtitle,
    showBack,
    showLocation,
    location,
    deliveryTime,
    onBackPress,
    onLocationPress,
    rightComponent,
    transparent = false,
    whiteBackground = false,
}) => {
    const { t } = useTranslation();
    
    if (showLocation) {
        return (
            <View style={[
                styles.locationHeader, 
                transparent && styles.transparentHeader,
                whiteBackground && styles.whiteHeader
            ]}>
                {showBack ? (
                    <TouchableOpacity
                        style={styles.backButtonLocation}
                        onPress={onBackPress}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={COLORS.text}
                        />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.locationIconWrapper}
                        onPress={onLocationPress}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="map-marker"
                            size={22}
                            color={COLORS.text}
                        />
                    </TouchableOpacity>
                )}
                
                <TouchableOpacity
                    style={styles.locationContainer}
                    onPress={onLocationPress}
                    activeOpacity={0.7}
                >
                    <View style={styles.locationTexts}>
                        <View style={styles.locationTitleRow}>
                            <Text style={styles.locationTitle}>{location || t('home')}</Text>
                            <MaterialCommunityIcons
                                name="chevron-down"
                                size={20}
                                color={COLORS.text}
                            />
                        </View>
                        <Text style={styles.locationSubtitle} numberOfLines={1}>
                            {subtitle || t('deliverTo')}
                        </Text>
                    </View>
                </TouchableOpacity>

                {deliveryTime && (
                    <View style={styles.deliveryBadge}>
                        <MaterialCommunityIcons
                            name="lightning-bolt"
                            size={16}
                            color={COLORS.secondary}
                        />
                        <Text style={styles.deliveryText}>{deliveryTime}</Text>
                    </View>
                )}

                {rightComponent && (
                    <View style={styles.rightComponent}>{rightComponent}</View>
                )}
            </View>
        );
    }

    return (
        <View style={[styles.header, transparent && styles.transparentHeader]}>
            {showBack && (
                <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
                    <View style={styles.backButtonInner}>
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={22}
                            color={COLORS.text}
                        />
                    </View>
                </TouchableOpacity>
            )}

            <View style={[styles.titleContainer, !showBack && styles.titleContainerNoBack]}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>

            {rightComponent && (
                <View style={styles.rightComponent}>{rightComponent}</View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    transparentHeader: {
        backgroundColor: 'transparent',
        borderBottomWidth: 0,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: COLORS.primary,
        minHeight: 70,
    },
    whiteHeader: {
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backButtonLocation: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    backButton: {
        marginRight: 12,
    },
    backButtonInner: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.background,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainer: {
        flex: 1,
    },
    titleContainerNoBack: {
        paddingLeft: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    locationContainer: {
        flex: 1,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    locationTexts: {
        flex: 1,
    },
    locationTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    locationTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.text,
        letterSpacing: -0.3,
    },
    locationSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 3,
        fontWeight: '500',
    },
    deliveryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 24,
        marginLeft: 12,
        ...SHADOWS.light,
    },
    deliveryText: {
        fontSize: 14,
        fontWeight: '800',
        color: COLORS.secondary,
        marginLeft: 4,
    },
    rightComponent: {
        marginLeft: 12,
    },
});

export default Header;
