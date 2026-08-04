import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants';

const PASTEL_COLORS = [
    { bg: '#FFF3E0', border: '#FFE0B2', glow: 'rgba(255, 152, 0, 0.12)' }, // Soft Amber / Peach
    { bg: '#E8F5E9', border: '#C8E6C9', glow: 'rgba(76, 175, 80, 0.12)' },  // Soft Mint Green
    { bg: '#E3F2FD', border: '#BBDEFB', glow: 'rgba(33, 150, 243, 0.12)' }, // Soft Sky Blue
    { bg: '#F3E5F5', border: '#E1BEE7', glow: 'rgba(156, 39, 176, 0.12)' }, // Soft Lavender
    { bg: '#FFF8E1', border: '#FFECB3', glow: 'rgba(255, 193, 7, 0.12)' },  // Soft Butter Yellow
    { bg: '#FCE4EC', border: '#F8BBD0', glow: 'rgba(233, 30, 99, 0.12)' },  // Soft Pastel Pink
    { bg: '#E0F2F1', border: '#B2DFDB', glow: 'rgba(0, 150, 136, 0.12)' },  // Soft Teal
    { bg: '#FFEBEE', border: '#FFCDD2', glow: 'rgba(244, 67, 54, 0.12)' },  // Soft Coral
];

const getPastelTheme = (color, index = 0) => {
    if (color && color !== '#F5F5F5' && color !== '#E8F5E9') {
        return { bg: color, border: 'rgba(0,0,0,0.06)', glow: 'rgba(0,0,0,0.05)' };
    }
    const idx = Math.abs(index) % PASTEL_COLORS.length;
    return PASTEL_COLORS[idx];
};

const CategoryCard = ({ category, onPress, index = 0, size = 'medium', showItemCount = false, width: customWidth }) => {
    const isSmall = size === 'small';
    const isMedium = size === 'medium';
    const isLarge = size === 'large';

    const theme = getPastelTheme(category.color, index);

    // Check if we have a valid image URL
    const hasValidImage = category.image && (
        category.image.startsWith('http://') || 
        category.image.startsWith('https://') || 
        category.image.startsWith('data:image/')
    );

    if (isLarge) {
        // Large card layout (horizontal)
        return (
            <TouchableOpacity
                style={[
                    styles.container,
                    styles.largeContainer,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                ]}
                onPress={onPress}
                activeOpacity={0.85}
            >
                <View style={styles.imageWrapper}>
                    {hasValidImage ? (
                        <Image
                            source={{ uri: category.image }}
                            style={styles.largeImage}
                            resizeMode="contain"
                        />
                    ) : (
                        <MaterialCommunityIcons
                            name={category.icon || 'package-variant'}
                            size={38}
                            color={COLORS.secondary}
                        />
                    )}
                </View>
                <Text style={styles.largeName} numberOfLines={2}>
                    {category.name}
                </Text>
                <View style={styles.arrowContainer}>
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={18}
                        color={COLORS.textSecondary}
                    />
                </View>
            </TouchableOpacity>
        );
    }

    // Small and Medium card layout (vertical with text below)
    return (
        <View style={[styles.wrapper, customWidth ? { width: customWidth, marginRight: 0 } : null]}>
            <TouchableOpacity
                style={[
                    styles.coloredBox,
                    isSmall && styles.smallBox,
                    isMedium && styles.mediumBox,
                    customWidth ? { width: customWidth, height: customWidth, borderRadius: 20 } : null,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                ]}
                onPress={onPress}
                activeOpacity={0.85}
            >
                {/* Soft ambient inner glow */}
                <View style={[styles.glowBlob, { backgroundColor: theme.glow }]} />

                {/* Category Image or Icon */}
                <View style={[
                    styles.imageWrapper,
                    isSmall && styles.smallImageWrapper,
                    isMedium && styles.mediumImageWrapper,
                ]}>
                    {hasValidImage ? (
                        <Image
                            source={{ uri: category.image }}
                            style={[
                                styles.image,
                                isSmall && styles.smallImage,
                                isMedium && styles.mediumImage,
                            ]}
                            resizeMode="contain"
                        />
                    ) : (
                        <MaterialCommunityIcons
                            name={category.icon || 'package-variant'}
                            size={isSmall ? 32 : 50}
                            color={COLORS.secondary}
                        />
                    )}
                </View>

                {/* Item Count Badge */}
                {showItemCount && category.itemCount && (
                    <View style={styles.itemCountBadge}>
                        <Text style={styles.itemCountText}>{category.itemCount} items</Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Category Name - Below the box */}
            <Text
                style={[
                    styles.nameBelow,
                    isSmall && styles.smallNameBelow,
                    isMedium && styles.mediumNameBelow,
                    customWidth ? { width: customWidth } : null,
                ]}
                numberOfLines={2}
            >
                {category.name}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginRight: 12,
        alignItems: 'center',
    },
    coloredBox: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        padding: 12,
        borderWidth: 1,
        ...SHADOWS.light,
        position: 'relative',
        overflow: 'hidden',
    },
    glowBlob: {
        position: 'absolute',
        top: -15,
        right: -15,
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    smallBox: {
        width: 90,
        height: 90,
        padding: 6,
        borderRadius: 16,
    },
    mediumBox: {
        width: 110,
        height: 110,
        padding: 8,
        borderRadius: 18,
    },
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        marginRight: 12,
        padding: 12,
        ...SHADOWS.light,
        position: 'relative',
    },
    largeContainer: {
        width: '100%',
        height: 85,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingHorizontal: 16,
        borderRadius: 18,
        marginBottom: 10,
        marginRight: 0,
        ...SHADOWS.light,
    },
    imageWrapper: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        padding: 0,
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    smallImageWrapper: {
        padding: 0,
        borderRadius: 10,
    },
    mediumImageWrapper: {
        padding: 0,
        borderRadius: 12,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    smallImage: {
        width: '100%',
        height: '100%',
    },
    mediumImage: {
        width: '100%',
        height: '100%',
    },
    largeImage: {
        width: 48,
        height: 48,
    },
    nameBelow: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 16,
        width: 110,
    },
    smallNameBelow: {
        fontSize: 11,
        marginTop: 6,
        lineHeight: 14,
        width: 90,
    },
    mediumNameBelow: {
        fontSize: 13,
        marginTop: 8,
        lineHeight: 16,
        width: 110,
    },
    largeName: {
        fontSize: 15,
        marginTop: 0,
        marginLeft: 14,
        textAlign: 'left',
        fontWeight: '700',
        flex: 1,
        color: COLORS.text,
    },
    itemCountBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    itemCountText: {
        fontSize: 9,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    arrowContainer: {
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 12,
        padding: 6,
    },
});

export default CategoryCard;
