/**
 * SectionHeader — title row above a rail or grid, with an optional "See all" link.
 * SheetHeader  — title row at the top of a BottomSheet / modal with a close button.
 *
 * <SectionHeader> props
 *   title         string
 *   subtitle      string (optional, muted caption under the title)
 *   actionLabel   string (default 'See all' when onActionPress is given)
 *   onActionPress () => void — shows the green link with a chevron
 *   size          'md' (h3, default) | 'lg' (h2, for top-of-page sections)
 *   style
 *
 * <SheetHeader> props
 *   title, subtitle, onClose (shows a close IconButton), style
 *
 * Example
 *   <SectionHeader title="Dairy, Bread & Eggs" onActionPress={() => nav.navigate('Category', { id })} />
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../../constants/theme';
import { useTheme } from '../../theme';
import { Text } from './Text';
import { PressableScale } from './PressableScale';
import { IconButton } from './IconButton';

export function SectionHeader({ title, subtitle, actionLabel, onActionPress, size = 'md', style }) {
    const { colors } = useTheme();
    return (
        <View style={[styles.row, style]}>
            <View style={styles.titles}>
                <Text variant={size === 'lg' ? 'h2' : 'h3'} accessibilityRole="header" numberOfLines={1}>
                    {title}
                </Text>
                {subtitle ? (
                    <Text variant="caption" color="muted" numberOfLines={1} style={styles.sub}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            {onActionPress ? (
                <PressableScale
                    onPress={onActionPress}
                    haptic="selection"
                    accessibilityRole="link"
                    accessibilityLabel={`${actionLabel || 'See all'} ${title}`}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
                    style={styles.action}
                >
                    <Text variant="label" color="accent">
                        {actionLabel || 'See all'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brandText} style={styles.chev} />
                </PressableScale>
            ) : null}
        </View>
    );
}

export function SheetHeader({ title, subtitle, onClose, style }) {
    return (
        <View style={[styles.sheetRow, style]}>
            <View style={styles.titles}>
                <Text variant="h3" accessibilityRole="header">
                    {title}
                </Text>
                {subtitle ? (
                    <Text variant="body" color="secondary" style={styles.sub}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            {onClose ? <IconButton name="close" variant="tinted" size="sm" accessibilityLabel="Close" onPress={onClose} /> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: space.md },
    sheetRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: space.xs, paddingBottom: space.lg },
    titles: { flex: 1, paddingRight: space.md },
    sub: { marginTop: 2 },
    action: { flexDirection: 'row', alignItems: 'center', paddingBottom: 2 },
    chev: { marginLeft: -2, marginTop: 1 },
});

export default SectionHeader;
