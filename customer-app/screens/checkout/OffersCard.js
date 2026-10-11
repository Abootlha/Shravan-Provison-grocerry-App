import React, { memo } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, RollingNumber, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { GROUP_RADIUS, ICON_CIRCLE } from './layout';

/**
 * Offers row. There is no coupon API yet, so this only shows the one real offer: the
 * store-wide discount that OrdersService applies to every order. Nothing to apply,
 * nothing faked; it hides itself when the discount rounds to ₹0.
 */
function OffersCardBase({ discount, rate, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    if (!(discount > 0)) return null;
    const pct = rate != null ? Math.round(rate * 100) : null;
    return (
        <Card padding={0} radius={GROUP_RADIUS} style={styles.card}>
            <View style={styles.row} accessibilityRole="text">
                <View style={styles.icon}>
                    <MaterialCommunityIcons name="ticket-percent-outline" size={20} color={colors.inkSecondary} />
                </View>
                <View style={styles.texts}>
                    <Text variant="bodyStrong">
                        {pct
                            ? (isHi ? `${pct}% स्टोर छूट लागू` : `${pct}% store discount applied`)
                            : (isHi ? 'स्टोर छूट लागू' : 'Store discount applied')}
                    </Text>
                    <Text variant="caption" color="muted">
                        {isHi ? 'हर ऑर्डर पर अपने आप' : 'Automatic on every order · no code needed'}
                    </Text>
                </View>
                <View style={styles.saved}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                    <RollingNumber value={discount} prefix="−₹" variant="price" color="success" />
                </View>
            </View>
        </Card>
    );
}

export const OffersCard = memo(OffersCardBase);

const useStyles = makeStyles((t) => ({
    card: { overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
    icon: {
        width: ICON_CIRCLE + space.xs,
        height: ICON_CIRCLE + space.xs,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texts: { flex: 1, gap: space.xxs },
    saved: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
}));

export default OffersCard;
