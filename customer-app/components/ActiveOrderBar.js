/**
 * ActiveOrderBar — the persistent "your order is on its way" bar. Same language as the floating
 * cart bar (ink surface — dark: raised + hairline — 56pt, r14, floating shadow, violet CTA on the
 * right): a static scooter glyph on a flat disc, next to "Arriving in **7 mins**" and the live
 * status. Tapping opens order tracking. Purely presentational unless you use the hook.
 *
 * Props
 *   order        order object (needs orderStatus; uses tracking.durationMinutes /
 *                estimatedDeliveryTime for the ETA). Renders nothing when null or not active.
 *   etaMinutes   number — optional override for the ETA
 *   onPress      () => void — usually navigation.navigate('OrderTracking', { orderId })
 *   style        container style (position it yourself, e.g. absolute above the tab bar)
 *
 * Hook
 *   const { order, refresh } = useActiveOrder();   // fetches the user's orders on screen focus
 *                                                   // and returns the newest active one (or null)
 *
 * Example (Home)
 *   const { order } = useActiveOrder();
 *   {order ? (
 *     <ActiveOrderBar order={order} style={{ position: 'absolute', left: 16, right: 16, bottom: 96 }}
 *       onPress={() => navigation.navigate('OrderTracking', { orderId: order._id || order.orderId })} />
 *   ) : null}
 *
 * Motion: none at rest (DESIGN.md: no looping scooter). Entry is a short fade-up; the exit is
 * faster; the ETA number rolls when it changes.
 */
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { fontFamily, radii, space } from '../constants/theme';
import { useTheme, makeStyles } from '../theme';
import { nightPill } from './product/nightPill';
import { durations, press } from '../theme/motion';
import { PressableScale, RollingNumber, Text } from './ui';
import { OrderService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { getEtaMinutes, getStatusMeta, isActiveOrder } from '../screens/orders/orderUtils';

/** Height of the order pill — screens stacking it above the cart pill import this. */
export const ORDER_BAR_HEIGHT = 56;
const PILL_HEIGHT = ORDER_BAR_HEIGHT;
const PILL_RADIUS = 14; // matches the floating cart bar (rounded rect, not a pill)
const DISC = 40;

function Scooter() {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.disc} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <MaterialCommunityIcons name="moped" size={22} color={colors.onNight} />
        </View>
    );
}

export function ActiveOrderBar({ order, etaMinutes, onPress, style }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { isHi } = useTranslation();
    if (!order || !isActiveOrder(order)) return null;
    const eta = Number.isFinite(etaMinutes) ? etaMinutes : getEtaMinutes({ order });
    const status = getStatusMeta(order.orderStatus, isHi).label;
    const pending = order.orderStatus === 'PENDING';
    const subline = pending
        ? isHi ? 'स्टोर पुष्टि कर रहा है' : 'Store is confirming'
        : isHi ? `ऑर्डर · ${status}` : `Order ${status.toLowerCase()}`;
    const unit = isHi ? 'मिनट' : eta === 1 ? 'min' : 'mins';

    return (
        <Animated.View entering={FadeInDown.duration(durations.base)} exiting={FadeOutDown.duration(durations.fast)} style={style}>
            <PressableScale
                onPress={onPress}
                haptic="light"
                scaleTo={press.subtle}
                style={styles.pill}
                accessibilityLabel={`${subline}${eta ? `, ${isHi ? 'पहुँचेगा' : 'arriving in'} ${eta} ${isHi ? 'मिनट' : 'minutes'}` : ''}. ${isHi ? 'ट्रैक करें' : 'Track order'}`}
            >
                <Scooter />
                <View style={styles.text}>
                    {eta && !pending ? (
                        <View style={styles.etaRow}>
                            {isHi ? null : <Text variant="title" weight="regular" color="onNight">Arriving in </Text>}
                            <RollingNumber value={eta} variant="title" color="onNight" style={styles.bold} />
                            <Text variant="title" color="onNight" style={styles.bold}>{` ${unit}`}</Text>
                            {isHi ? <Text variant="title" weight="regular" color="onNight"> में</Text> : null}
                        </View>
                    ) : (
                        <Text variant="title" color="onNight" numberOfLines={1}>{isHi ? 'ऑर्डर मिल गया' : 'Order received'}</Text>
                    )}
                    <Text variant="caption" color="onNightSecondary" numberOfLines={1}>{subline}</Text>
                </View>
                <View style={styles.cta}>
                    <Text variant="label" color="onNight">{isHi ? 'ट्रैक' : 'Track'}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.onNight} />
                </View>
            </PressableScale>
        </Animated.View>
    );
}

/** Fetches the signed-in user's orders on focus and returns the newest active one. */
export function useActiveOrder() {
    const userId = useSelector((state) => state.auth?.user?.id);
    const [order, setOrder] = useState(null);
    const refresh = useCallback(async () => {
        if (!userId) {
            setOrder(null);
            return;
        }
        try {
            const res = await OrderService.getOrders(userId);
            const list = Array.isArray(res) ? res : res?.orders || [];
            const active = list
                .filter(isActiveOrder)
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
            setOrder(active || null);
        } catch (e) {
            // keep the last known value
        }
    }, [userId]);
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );
    return { order, refresh };
}

const useStyles = makeStyles((t) => ({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        height: PILL_HEIGHT,
        paddingHorizontal: space.sm,
        borderRadius: PILL_RADIUS,
        ...t.shadows.floating,
        ...nightPill(t),
    },
    disc: {
        width: DISC,
        height: DISC,
        borderRadius: DISC / 2,
        backgroundColor: t.colors.haloOnBrand,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: { flex: 1, gap: 1 },
    etaRow: { flexDirection: 'row', alignItems: 'center' },
    bold: { fontFamily: fontFamily.extrabold },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xxs,
        height: 40,
        paddingLeft: space.md,
        paddingRight: space.xs,
        borderRadius: radii.button,
        backgroundColor: t.colors.brand,
    },
}));

export default ActiveOrderBar;
