/**
 * StatusCard — the one card under the tracking map (quick-commerce layout):
 *
 *   ┌───────────────────────────────── [On time] ┐
 *   │ Arriving in                                 │
 *   │ 13 mins            (display, brand violet)  │
 *   │ Your order is getting packed   (h2, ink)    │
 *   ├─────────────────────────────────────────────┤
 *   │ (MK)  Md Kaif              (call)           │   delivery partner (when assigned)
 *   │       Delivery Partner                      │
 *   ├─────────────────────────────────────────────┤
 *   │ [bag] 2 Items · ₹78 saved ›                 │   opens the order details
 *   │       Delivering to Home: Golghar Chauraha… │
 *   └─────────────────────────────────────────────┘
 *
 * Statuses without an ETA (pending, arrived) show copy.title as the big line instead.
 * A status change crossfades the headline (ContentSwap); nothing loops.
 *
 * Props: copy (getHeaderCopy), status, etaMinutes, onTime, delayNote, rider (getRider), stale,
 *        order, isHi, onViewDetails
 */
import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { radii, space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { ContentSwap, Divider, IconButton, Text } from '../../components/ui';
import { countItems, formatMoney, getBill, initialsOf } from '../orders/orderUtils';

const addressLine = (order, isHi) => {
    const a = order?.deliveryAddress || {};
    const label = a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : '';
    const where = [a.landmark, a.address].filter(Boolean).join(', ');
    if (!where) return '';
    return `${isHi ? 'डिलीवरी' : 'Delivering to'} ${label ? `${label}: ` : ''}${where}`;
};

export function StatusCard({ copy, status, etaMinutes, onTime, delayNote, rider, stale, order, isHi, onViewDetails }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const showEta = copy?.eta && Number.isFinite(etaMinutes);
    const unit = isHi ? 'मिनट' : etaMinutes === 1 ? 'min' : 'mins';
    const count = countItems(order);
    const saved = getBill(order).discount;
    const where = addressLine(order, isHi);
    const name = rider?.name || (isHi ? 'डिलीवरी पार्टनर' : 'Delivery partner');
    const call = () => rider?.phone && Linking.openURL(`tel:${rider.phone}`);

    return (
        <View style={styles.card}>
            {onTime ? (
                <View style={styles.onTime} accessibilityLabel={isHi ? 'समय पर' : 'On time'}>
                    <MaterialCommunityIcons name="lightning-bolt" size={14} color={colors.onBrand} />
                    <Text variant="label" color={colors.onBrand}>{isHi ? 'समय पर' : 'On time'}</Text>
                </View>
            ) : null}

            <ContentSwap stateKey={`${status}-${showEta ? 'eta' : 'title'}`}>
                <View style={styles.head} accessibilityLiveRegion="polite">
                    {showEta ? (
                        <View accessibilityLabel={isHi ? `${etaMinutes} मिनट में पहुँचेगा` : `Arriving in ${etaMinutes} ${etaMinutes === 1 ? 'minute' : 'minutes'}`}>
                            <Text variant="body" color="secondary">{isHi ? 'पहुँचेगा' : 'Arriving in'}</Text>
                            <Text variant="display" color="brand" tabular style={styles.eta}>
                                {etaMinutes} {unit}
                            </Text>
                        </View>
                    ) : (
                        <Text variant="h1" accessibilityRole="header" style={styles.title}>
                            {copy?.title || (isHi ? 'जल्द पहुँचेगा' : 'Arriving soon')}
                        </Text>
                    )}
                    {copy?.headline || copy?.sub ? (
                        <Text variant="h2" numberOfLines={2} style={styles.headline}>
                            {copy?.headline || copy?.sub}
                        </Text>
                    ) : null}
                    {showEta && delayNote ? (
                        <View style={styles.note}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={16} color={colors.warning} />
                            <Text variant="caption" color="secondary" style={styles.flex}>{delayNote}</Text>
                        </View>
                    ) : null}
                </View>
            </ContentSwap>

            {rider ? (
                <>
                    <Divider />
                    <View style={styles.row}>
                        <View style={styles.avatar}>
                            <Text variant="title" color={colors.brandStrong}>{initialsOf(name)}</Text>
                            <View style={styles.moped}>
                                <MaterialCommunityIcons name="moped" size={11} color={colors.onBrand} />
                            </View>
                        </View>
                        <View style={styles.flex}>
                            <Text variant="title" numberOfLines={1}>{name}</Text>
                            <Text variant="caption" color="muted" numberOfLines={1}>
                                {[isHi ? 'डिलीवरी पार्टनर' : 'Delivery Partner', rider.vehicleNumber].filter(Boolean).join(' · ')}
                            </Text>
                        </View>
                        {rider.phone ? (
                            <IconButton
                                name="phone-outline"
                                variant="surface"
                                size="lg"
                                color={colors.brand}
                                accessibilityLabel={isHi ? `${name} को कॉल करें` : `Call ${name}`}
                                onPress={call}
                                style={styles.call}
                            />
                        ) : null}
                    </View>
                    {stale ? (
                        <View style={styles.note}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={16} color={colors.warning} />
                            <Text variant="caption" color="warning" style={styles.flex}>
                                {isHi
                                    ? 'राइडर की लाइव लोकेशन में देरी है। सिग्नल मिलते ही अपडेट होगी।'
                                    : 'Live location is delayed. It updates as soon as the rider has signal.'}
                            </Text>
                        </View>
                    ) : null}
                </>
            ) : null}

            <Divider />
            <Pressable
                onPress={onViewDetails}
                disabled={!onViewDetails}
                accessibilityRole="button"
                accessibilityLabel={`${count} ${isHi ? 'सामान' : count === 1 ? 'item' : 'items'}${saved > 0 ? `, ${formatMoney(saved)} ${isHi ? 'बचाए' : 'saved'}` : ''}. ${where}`}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
                <View style={styles.bag}>
                    <MaterialCommunityIcons name="shopping-outline" size={22} color={colors.brandStrong} />
                </View>
                <View style={styles.flex}>
                    <View style={styles.itemsLine}>
                        <Text variant="title">
                            {count} {isHi ? 'सामान' : count === 1 ? 'Item' : 'Items'}
                        </Text>
                        {saved > 0 ? (
                            <Text variant="title" color="success">
                                {' · '}
                                {formatMoney(saved)} {isHi ? 'बचाए' : 'saved'}
                            </Text>
                        ) : null}
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.inkSecondary} />
                    </View>
                    {where ? (
                        <Text variant="caption" color="muted" numberOfLines={1}>{where}</Text>
                    ) : null}
                </View>
            </Pressable>
        </View>
    );
}

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    card: {
        backgroundColor: t.colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: t.colors.hairline,
        padding: space.lg,
        gap: space.md,
        overflow: 'hidden',
    },
    onTime: {
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: space.md,
        paddingVertical: space.xs + 2,
        borderBottomLeftRadius: radii.card,
        backgroundColor: t.colors.success,
    },
    head: { gap: space.xxs, paddingTop: space.xs },
    eta: { fontSize: 44, lineHeight: 50 },
    title: { marginTop: space.xxs },
    headline: { marginTop: space.sm },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: radii.pill,
        backgroundColor: t.colors.brandTint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moped: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: t.colors.surface,
        backgroundColor: t.colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
    },
    call: { borderRadius: radii.pill, borderWidth: 1, borderColor: t.colors.border },
    bag: {
        width: 48,
        height: 48,
        borderRadius: radii.md,
        backgroundColor: t.colors.brandTint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemsLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
}));

export default StatusCard;
