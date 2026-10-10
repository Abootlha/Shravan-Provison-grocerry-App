import React, { memo } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, Button, IconButton, PressableScale, SwipeableRow, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { press } from '../../theme/motion';
import { addressIcon, formatAddressLine } from './addressUtils';

/**
 * A saved address: tap to deliver there; edit / delete / make default inline.
 * `onSwipeDelete` (optional) makes the card swipeable — swipe left to reveal Delete, a full
 * swipe commits (the screen removes it optimistically and offers Undo). Flat card + hairline;
 * the selected card gets a violet border and a brand-tint icon tile.
 */
function SavedAddressCardBase({ item, index, selected, distanceKm, deliverable, onSelect, onEdit, onDelete, onSwipeDelete, onMakeDefault, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const title = item.type || 'Home';
    const deleteLabel = isHi ? 'हटाएं' : 'Delete';

    const body = (
        <View style={[styles.card, selected && styles.cardSelected]}>
            <PressableScale
                onPress={() => onSelect(item)}
                haptic="selection"
                scaleTo={press.subtle}
                accessibilityRole="radio"
                accessibilityState={{ selected, checked: selected }}
                accessibilityLabel={`${title}, ${formatAddressLine(item)}`}
                style={styles.top}
            >
                <View style={[styles.tile, selected && styles.tileOn]}>
                    <MaterialCommunityIcons name={addressIcon(item.type)} size={20} color={selected ? colors.brandText : colors.inkSecondary} />
                </View>
                <View style={styles.texts}>
                    <View style={styles.titleRow}>
                        <Text variant="title" numberOfLines={1} style={styles.title}>{title}</Text>
                        {item.isDefault ? <Badge tone="soft" size="sm" label={isHi ? 'डिफ़ॉल्ट' : 'Default'} /> : null}
                        {selected ? <MaterialCommunityIcons name="check-circle" size={18} color={colors.brandText} /> : null}
                    </View>
                    <Text variant="body" color="secondary" numberOfLines={2}>{formatAddressLine(item)}</Text>
                    {distanceKm != null ? (
                        <Text variant="caption" color={deliverable ? 'muted' : 'error'}>
                            {deliverable
                                ? (isHi ? `स्टोर से ${distanceKm} किमी` : `${distanceKm} km from store`)
                                : (isHi ? `${distanceKm} किमी · डिलीवरी उपलब्ध नहीं` : `${distanceKm} km · outside delivery area`)}
                        </Text>
                    ) : null}
                </View>
            </PressableScale>
            <View style={styles.actions}>
                {!item.isDefault ? (
                    <Button
                        label={isHi ? 'डिफ़ॉल्ट बनाएं' : 'Make default'}
                        variant="ghost"
                        size="sm"
                        onPress={() => onMakeDefault(item, index)}
                    />
                ) : <View />}
                <View style={styles.iconActions}>
                    <IconButton
                        name="pencil-outline"
                        variant="tinted"
                        size="sm"
                        color={colors.inkSecondary}
                        accessibilityLabel={isHi ? `${title} पता संपादित करें` : `Edit ${title} address`}
                        onPress={() => onEdit(item, index)}
                    />
                    <IconButton
                        name="trash-can-outline"
                        variant="tinted"
                        size="sm"
                        color={colors.inkSecondary}
                        accessibilityLabel={isHi ? `${title} पता हटाएं` : `Delete ${title} address`}
                        onPress={() => onDelete(item, index)}
                    />
                </View>
            </View>
        </View>
    );

    if (!onSwipeDelete) return <View style={[styles.shell, selected && styles.shellSelected]}>{body}</View>;

    return (
        <View style={[styles.shell, selected && styles.shellSelected]}>
            <SwipeableRow
                radius={radii.card}
                actionLabel={deleteLabel}
                accessibilityActionLabel={isHi ? `${title} पता हटाएं` : `Delete ${title} address`}
                onAction={() => onSwipeDelete(item, index)}
            >
                {body}
            </SwipeableRow>
        </View>
    );
}

export const SavedAddressCard = memo(SavedAddressCardBase);

const useStyles = makeStyles((t) => ({
    shell: { borderRadius: radii.card, backgroundColor: t.colors.surface },
    shellSelected: {},
    card: {
        backgroundColor: t.colors.surface,
        borderRadius: radii.card,
        borderWidth: 1.5,
        borderColor: t.colors.hairline,
        padding: space.lg,
        paddingBottom: space.sm,
        gap: space.sm,
    },
    cardSelected: { borderColor: t.colors.brand },
    top: { flexDirection: 'row', gap: space.md },
    tile: { width: 40, height: 40, borderRadius: radii.well, backgroundColor: t.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
    tileOn: { backgroundColor: t.colors.brandTint },
    texts: { flex: 1, gap: space.xxs },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    title: { flexShrink: 1 },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 52 - space.sm },
    iconActions: { flexDirection: 'row', gap: space.xs },
}));

export default SavedAddressCard;
