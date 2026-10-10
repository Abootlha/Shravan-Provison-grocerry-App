import React, { memo } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';

const SIZE = 44;

/** "Use my current location" row. While locating, the GPS glyph swaps for a spinner (work in progress, not an idle loop). */
function CurrentLocationRowBase({ loading, onPress, etaMinutes = 10, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <Card
            onPress={loading ? undefined : onPress}
            haptic="light"
            padding="md"
            accessibilityRole="button"
            accessibilityState={{ busy: !!loading }}
            accessibilityLabel={isHi ? 'वर्तमान स्थान का उपयोग करें' : 'Use my current location'}
            style={styles.row}
        >
            <View style={styles.iconWrap}>
                {loading
                    ? <ActivityIndicator size="small" color={colors.brandText} />
                    : <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.brandText} />}
            </View>
            <View style={styles.texts}>
                <Text variant="title" color="accent">
                    {loading
                        ? (isHi ? 'आपका स्थान खोज रहे हैं…' : 'Finding your location…')
                        : (isHi ? 'वर्तमान स्थान का उपयोग करें' : 'Use my current location')}
                </Text>
                <Text variant="caption" color="muted">
                    {isHi ? `GPS से · ${etaMinutes} मिनट में डिलीवरी` : `Using GPS · delivery in ${etaMinutes} mins`}
                </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.inkMuted} />
        </Card>
    );
}

export const CurrentLocationRow = memo(CurrentLocationRowBase);

const useStyles = makeStyles((t) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    iconWrap: {
        width: SIZE,
        height: SIZE,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: { flex: 1, gap: space.xxs },
}));

export default CurrentLocationRow;
