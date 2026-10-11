/**
 * CategoryCard — a category tile on the neutral image well (r10) with a two-line label underneath
 * (DESIGN.md: no pastel tints, no well light). One picture per tile:
 *   · Photo: the category photo fills ~86% of the well.
 *   · No photo: the category's Fluent 3D icon (Icon3D) identifies it.
 *   · Neither: the MCI glyph fallback in secondary ink.
 *
 * Props
 *   category   { id, name, icon, image, color, icon3d }  icon may be an MCI glyph name or an image URL;
 *              icon3d is an Icon3D name (see icon3dFor)
 *   index      kept for callers (tiles no longer cycle a tint)
 *   prefer3D   boolean — show the 3D icon even when there is a photo (default false)
 *   onPress
 *   width      tile width (default 80). The tile is square; the label sits underneath.
 *   style
 */
import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Icon3D, PressableScale, Text } from './ui';
import { radii, space } from '../constants/theme';
import { useTheme } from '../theme';
import { press } from '../theme/motion';

const isUri = (v) => typeof v === 'string' && (/^https?:\/\//.test(v) || v.startsWith('data:image/'));
const looksLikeIcon = (uri) => /\.(png|svg|webp)(\?|$)/i.test(uri) || /icon/i.test(uri);

// eslint-disable-next-line no-unused-vars
const CategoryCard = ({ category, index = 0, prefer3D = false, onPress, width = 80, style }) => {
    const { colors } = useTheme();
    const sticker = category?.icon3d || null;
    const rawUri = isUri(category?.image) ? category.image : isUri(category?.icon) ? category.icon : null;
    const uri = prefer3D && sticker ? null : rawUri;
    const glyph = typeof category?.icon === 'string' && category.icon && !isUri(category.icon) ? category.icon : 'basket-outline';
    const iconMode = uri ? looksLikeIcon(uri) : false;

    return (
        <PressableScale
            onPress={onPress}
            haptic="selection"
            scaleTo={press.subtle}
            accessibilityLabel={category?.name}
            style={[{ width }, style]}
        >
            <View style={[styles.tile, { width, height: width, backgroundColor: colors.imageWell }]}>
                {uri ? (
                    <Image
                        source={{ uri }}
                        style={[iconMode ? styles.icon : styles.photo, !iconMode && { borderRadius: Math.round(width * 0.12) }]}
                        contentFit={iconMode ? 'contain' : 'cover'}
                        transition={150}
                        cachePolicy="memory-disk"
                        recyclingKey={uri}
                        accessible={false}
                    />
                ) : sticker ? (
                    <Icon3D name={sticker} size={Math.round(width * 0.64)} />
                ) : (
                    <MaterialCommunityIcons name={glyph} size={Math.round(width * 0.44)} color={colors.inkSecondary} />
                )}
            </View>
            <Text variant="caption" weight="semibold" align="center" numberOfLines={2} style={styles.label}>
                {category?.name}
            </Text>
        </PressableScale>
    );
};

const styles = StyleSheet.create({
    tile: {
        borderRadius: radii.well,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    photo: { width: '86%', height: '86%' },
    icon: { width: '84%', height: '84%' },
    label: { marginTop: space.sm, paddingHorizontal: space.xxs },
});

export default memo(CategoryCard);
