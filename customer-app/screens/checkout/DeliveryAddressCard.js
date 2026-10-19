import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Badge, Button, Card, SkeletonGroup, SkeletonListRow, Text } from '../../components/ui';
import { radii, space } from '../../constants/theme';
import { layout, makeStyles, useTheme } from '../../theme';
import { addressIcon, formatFullAddress, formatPhone, labelText } from '../address/addressUtils';
import { GROUP_RADIUS } from './layout';
import { AddressMapThumb } from './AddressMapThumb';

const Pin = ({ name }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.pin}>
            <MaterialCommunityIcons name={name} size={22} color={colors.inkSecondary} />
        </View>
    );
};

/**
 * "Delivering to" card on checkout: a still map strip (store + address), label, full address
 * (flat / floor / street / landmark / city / pincode), receiver and distance from the store, with
 * Change (address sheet) and Edit (the address form). The ETA is shown once, at the top of checkout. Without an address it is a clear "Add delivery address" call to action.
 *
 * outOfArea   the address is beyond the store's delivery radius: shown as an error and the
 *             screen blocks the order (see useCheckout.addressBlock).
 * canEdit     false for a one-off pin that is not a saved address (Edit then saves it).
 */
function DeliveryAddressCardBase({
    address, loading, distanceKm = null, outOfArea = false, radiusKm, store = null, coords = null,
    onChange, onEdit, onAdd, isHi,
}) {
    const styles = useStyles();
    const { colors } = useTheme();

    if (!address) {
        return (
            <Card padding={0} radius={GROUP_RADIUS}>
                {loading ? (
                    <SkeletonGroup style={styles.skeleton}>
                        <SkeletonListRow />
                    </SkeletonGroup>
                ) : (
                    <View style={styles.emptyBody}>
                        <View style={styles.row}>
                            <Pin name="map-marker-plus-outline" />
                            <View style={styles.texts}>
                                <Text variant="title" accessibilityRole="header">
                                    {isHi ? 'डिलीवरी पता जोड़ें' : 'Add a delivery address'}
                                </Text>
                                <Text variant="caption" color="muted">
                                    {isHi ? 'ऑर्डर देने के लिए हमें पता चाहिए।' : 'We need it before you can place the order.'}
                                </Text>
                            </View>
                        </View>
                        <Button
                            label={isHi ? 'डिलीवरी पता जोड़ें' : 'Add delivery address'}
                            variant="soft"
                            fullWidth
                            onPress={onAdd}
                            leftIcon={({ color, size }) => <MaterialCommunityIcons name="plus" size={size} color={color} />}
                        />
                    </View>
                )}
            </Card>
        );
    }

    const label = labelText(address.type || 'Home', isHi);
    const fullAddress = formatFullAddress(address, isHi);
    const receiver = [address.receiverName, formatPhone(address.receiverPhone)].filter(Boolean).join(' · ');
    const meta = distanceKm != null ? (isHi ? `स्टोर से ${distanceKm} किमी` : `${distanceKm} km from store`) : '';

    return (
        <Card padding={0} radius={GROUP_RADIUS} style={[styles.card, outOfArea && styles.cardError]}>
            {store && coords ? (
                <AddressMapThumb
                    store={store}
                    home={coords}
                    height={88}
                    label={isHi ? `नक्शा: स्टोर और ${label} पता` : `Map of the store and your ${label} address`}
                />
            ) : null}
            <Animated.View
                key={address.id || fullAddress}
                entering={layout.enter}
                style={styles.body}
                accessible
                accessibilityLabel={[
                    isHi ? 'डिलीवरी पता' : 'Delivering to',
                    label,
                    fullAddress,
                    receiver,
                    meta,
                ].filter(Boolean).join(', ')}
            >
                <View style={styles.headRow}>
                    <Text variant="title" accessibilityRole="header" style={styles.flex}>
                        {isHi ? 'डिलीवरी पता' : 'Delivering to'}
                    </Text>
                    <Badge
                        tone="neutral"
                        size="md"
                        label={label}
                        icon={({ color, size }) => <MaterialCommunityIcons name={addressIcon(address.type)} size={size} color={color} />}
                    />
                </View>
                <View style={styles.row}>
                    {store && coords ? null : <Pin name={outOfArea ? 'map-marker-off-outline' : 'map-marker-outline'} />}
                    <View style={styles.texts}>
                        <Text variant="body" color="ink" numberOfLines={4}>{fullAddress}</Text>
                        {receiver ? (
                            <View style={styles.metaRow}>
                                <MaterialCommunityIcons name="account-outline" size={14} color={colors.inkMuted} />
                                <Text variant="caption" color="secondary" numberOfLines={1} style={styles.flex}>{receiver}</Text>
                            </View>
                        ) : null}
                        {meta ? (
                            <View style={styles.metaRow}>
                                <MaterialCommunityIcons name="moped" size={14} color={outOfArea ? colors.errorInk : colors.inkMuted} />
                                <Text variant="caption" color={outOfArea ? 'error' : 'muted'} style={styles.flex}>{meta}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </Animated.View>

            {outOfArea ? (
                <View style={styles.warning} accessibilityLiveRegion="polite">
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.errorInk} />
                    <Text variant="caption" color={colors.errorInk} style={styles.flex}>
                        {isHi
                            ? `हम ${radiusKm} किमी तक ही डिलीवर करते हैं। ऑर्डर के लिए कोई दूसरा पता चुनें।`
                            : `We deliver within ${radiusKm} km of the store. Choose another address to place this order.`}
                    </Text>
                </View>
            ) : null}

            <View style={styles.actions}>
                <Button
                    label={isHi ? 'पता संपादित करें' : 'Edit'}
                    variant="ghost"
                    size="sm"
                    onPress={onEdit}
                    accessibilityLabel={isHi ? `${label} पता संपादित करें` : `Edit ${label} address`}
                    leftIcon={({ color, size }) => <MaterialCommunityIcons name="pencil-outline" size={size} color={color} />}
                />
                <Button
                    label={isHi ? 'बदलें' : 'Change'}
                    variant="soft"
                    size="sm"
                    onPress={onChange}
                    accessibilityLabel={isHi ? 'डिलीवरी पता बदलें' : 'Change delivery address'}
                />
            </View>
        </Card>
    );
}

export const DeliveryAddressCard = memo(DeliveryAddressCardBase);

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    card: { overflow: 'hidden' },
    cardError: { borderColor: t.colors.errorInk },
    body: { padding: space.lg, paddingBottom: space.md, gap: space.md },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    texts: { flex: 1, gap: space.xs },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    pin: {
        width: 44,
        height: 44,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    warning: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
        marginHorizontal: space.lg,
        marginBottom: space.md,
        padding: space.md,
        borderRadius: radii.well,
        backgroundColor: t.colors.errorTint,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: t.colors.hairline,
    },
    emptyBody: { padding: space.lg, gap: space.md },
    skeleton: { padding: space.lg },
}));

export default DeliveryAddressCard;
