/**
 * SettingsRow / SettingsGroup — grouped list rows for Profile and Edit profile.
 *
 * <SettingsGroup title>  a flat surface Card (hairline, radius 12) holding rows separated by inset
 *                        hairlines. The rows sit in an inner clip so each row's press tint follows
 *                        the card's rounded corners.
 * <SettingsRow icon title subtitle value onPress tone loading />
 *   icon     MaterialCommunityIcons name — a plain 20px line glyph in inkSecondary (no tile)
 *   tone     'default' | 'danger' (error ink, no chevron)
 *   icon3d / tint are accepted for old call sites and ignored (no 3D icons or tinted tiles in lists).
 * <SettingsBlock icon title subtitle>{control}</SettingsBlock>
 *   a non-pressable row with the same glyph + text and a full-width control underneath
 *   (Profile → Appearance hosts the theme switch in one).
 *
 * Press feedback: PressableHighlight (a tint fades in under the row — rows never scale).
 */
import React, { Children, Fragment, memo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { Card, Divider, PressableHighlight, Text } from '../../components/ui';

const ICON = 20;
// text starts after: row padding + glyph + gap
const TEXT_INSET = space.lg + ICON + space.md;

export const SettingsRow = memo(function SettingsRow({ icon, title, subtitle, value, onPress, tone = 'default', loading = false }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const danger = tone === 'danger';
    return (
        <PressableHighlight
            onPress={loading ? undefined : onPress}
            haptic={danger ? 'medium' : false}
            style={styles.row}
            accessibilityLabel={[title, subtitle, value].filter(Boolean).join(', ')}
            accessibilityState={{ busy: loading }}
        >
            {icon ? <MaterialCommunityIcons name={icon} size={ICON} color={danger ? colors.errorInk : colors.inkSecondary} /> : null}
            <View style={styles.text}>
                <Text variant="bodyStrong" color={danger ? 'error' : 'ink'} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text variant="caption" color="muted" numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {value ? <Text variant="label" color="secondary" tabular>{value}</Text> : null}
            {loading ? (
                <ActivityIndicator size="small" color={colors.errorInk} />
            ) : danger ? null : (
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.inkMuted} />
            )}
        </PressableHighlight>
    );
});

export function SettingsBlock({ icon, title, subtitle, children }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.block}>
            <View style={styles.blockHead}>
                {icon ? <MaterialCommunityIcons name={icon} size={ICON} color={colors.inkSecondary} /> : null}
                <View style={styles.text}>
                    <Text variant="bodyStrong" numberOfLines={1}>{title}</Text>
                    {subtitle ? <Text variant="caption" color="muted" numberOfLines={2}>{subtitle}</Text> : null}
                </View>
            </View>
            {children}
        </View>
    );
}

export function SettingsGroup({ title, children }) {
    const styles = useStyles();
    const rows = Children.toArray(children).filter(Boolean);
    return (
        <View style={styles.group}>
            {title ? (
                <Text variant="label" color="secondary" style={styles.groupTitle} accessibilityRole="header">
                    {title}
                </Text>
            ) : null}
            <Card padding={0}>
                <View style={styles.clip}>
                    {rows.map((row, i) => (
                        <Fragment key={row.key ?? i}>
                            {i > 0 ? <Divider inset={TEXT_INSET} /> : null}
                            {row}
                        </Fragment>
                    ))}
                </View>
            </Card>
        </View>
    );
}

const useStyles = makeStyles(() => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm },
    text: { flex: 1, gap: space.xxs },
    block: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
    blockHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    group: { gap: space.sm },
    groupTitle: { paddingHorizontal: space.xs },
    clip: { borderRadius: radii.card, overflow: 'hidden' },
}));
