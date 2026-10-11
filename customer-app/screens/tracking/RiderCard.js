/**
 * RiderCard — delivery partner row: initials avatar with a scooter badge, name + rating,
 * number plate chip + what they are doing now, and a violet call button.
 * A quiet warning appears when the live location has gone stale.
 *
 * Props: rider ({ name, phone, rating, vehicle, vehicleType, vehicleNumber }), stale (boolean), activeLeg, isHi
 */
import React from 'react';
import { Linking, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { Card, Divider, IconButton, Text } from '../../components/ui';
import { initialsOf } from '../orders/orderUtils';

export function RiderCard({ rider, stale, activeLeg, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const name = rider?.name || (isHi ? 'डिलीवरी पार्टनर' : 'Delivery partner');
    const onCall = () => rider?.phone && Linking.openURL(`tel:${rider.phone}`);
    const legText = activeLeg === 'to_store'
        ? isHi ? 'स्टोर की ओर जा रहे हैं' : 'Heading to the store'
        : isHi ? 'आपकी ओर आ रहे हैं' : 'Coming to you';
    const plate = rider?.vehicleNumber || (!rider?.vehicleType ? rider?.vehicle : null);

    return (
        <Card radius="lg" padding="lg">
            <View style={styles.row}>
                <View style={styles.avatar}>
                    <Text variant="title" color={colors.brandStrong}>{initialsOf(name)}</Text>
                    <View style={styles.moped}>
                        <MaterialCommunityIcons name="moped" size={12} color={colors.onBrand} />
                    </View>
                </View>
                <View style={styles.info}>
                    <View style={styles.nameRow}>
                        <Text variant="title" numberOfLines={1} style={styles.name}>{name}</Text>
                        {rider?.rating ? (
                            <View style={styles.rating} accessibilityLabel={`${isHi ? 'रेटिंग' : 'Rating'} ${Number(rider.rating).toFixed(1)}`}>
                                <MaterialCommunityIcons name="star" size={13} color={colors.ink} />
                                <Text variant="caption" weight="bold" tabular>{Number(rider.rating).toFixed(1)}</Text>
                            </View>
                        ) : null}
                    </View>
                    <View style={styles.subRow}>
                        {plate ? (
                            <View style={styles.plate}>
                                <Text variant="caption" weight="bold" color="secondary" tabular numberOfLines={1}>{plate}</Text>
                            </View>
                        ) : null}
                        <Text variant="caption" color="muted" numberOfLines={1} style={styles.name}>{legText}</Text>
                    </View>
                </View>
                {rider?.phone ? (
                    <IconButton name="phone" variant="brand" size="lg" accessibilityLabel={isHi ? `${name} को कॉल करें` : `Call ${name}`} onPress={onCall} />
                ) : null}
            </View>
            {stale ? (
                <>
                    <Divider spacing={space.md} />
                    <View style={styles.stale}>
                        <MaterialCommunityIcons name="clock-alert-outline" size={16} color={colors.warning} />
                        <Text variant="caption" color="warning" style={styles.info}>
                            {isHi ? 'राइडर की लाइव लोकेशन में देरी है। हम रूट रीफ़्रेश कर रहे हैं।' : "Live location is delayed. We're refreshing the route."}
                        </Text>
                    </View>
                </>
            ) : null}
        </Card>
    );
}

const useStyles = makeStyles((t) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: radii.pill,
        backgroundColor: t.colors.brandTint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moped: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: t.colors.surface,
        backgroundColor: t.colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: { flex: 1, gap: space.xs },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    name: { flexShrink: 1 },
    rating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: space.xs + 2,
        height: 22,
        borderRadius: radii.xs,
        backgroundColor: t.colors.surfaceSunken,
    },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    plate: {
        paddingHorizontal: space.sm,
        height: 22,
        justifyContent: 'center',
        borderRadius: radii.xs,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface,
    },
    stale: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));

export default RiderCard;
