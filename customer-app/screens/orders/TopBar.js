/**
 * TopBar — plain canvas header for secondary screens: back button, title (+ optional subtitle),
 * optional right element. Sits inside <Screen edges={['top']}>.
 *
 * Props: title, subtitle, onBack, right (element), isHi
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../../constants/theme';
import { IconButton, Text } from '../../components/ui';

export function TopBar({ title, subtitle, onBack, right, isHi }) {
    return (
        <View style={styles.bar}>
            {onBack ? (
                <IconButton name="arrow-left" variant="ghost" accessibilityLabel={isHi ? 'वापस जाएँ' : 'Go back'} onPress={onBack} />
            ) : null}
            <View style={styles.titles}>
                <Text variant="h3" numberOfLines={1} accessibilityRole="header">{title}</Text>
                {subtitle ? <Text variant="caption" color="muted" numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            {right || <View style={styles.spacer} />}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs, paddingVertical: space.xs, minHeight: 56 },
    titles: { flex: 1 },
    spacer: { width: 44 },
});

export default TopBar;
