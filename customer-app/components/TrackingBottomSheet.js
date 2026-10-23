/**
 * TrackingBottomSheet — the stack of cards under the tracking sheet's head panel
 * (the ETA headline + progress line live in the screen's head panel).
 * Order: delivered/cancelled hero · delivery OTP (neutral card, customer only) · partner · summary · help.
 *
 * Props
 *   order            current order (from orderTracking slice)
 *   riderLocation    latest rider fix (used for the stale-location warning)
 *   activeLeg        'to_store' | 'to_customer' | null
 *   isHi             Hindi copy
 *   onHelp           () => void — help row
 *   onViewDetails    () => void — "View full receipt"
 *   onShop           () => void — cancelled state CTA
 *   compact          live order: the StatusCard above already shows the partner and the order,
 *                    so only the delivery OTP and help are stacked here
 *
 * Motion: cards stagger in on first paint; when a card appears or goes (the OTP card at pickup, the
 * rider card at delivery) it fades and its neighbours slide (layout.list) instead of jumping.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { space } from '../constants/theme';
import { layout } from '../theme';
import DeliveryOtpCard from '../screens/tracking/DeliveryOtpCard';
import RiderCard from '../screens/tracking/RiderCard';
import OrderSummaryCard from '../screens/tracking/OrderSummaryCard';
import { CancelledHero, DeliveredHero, HelpRow } from '../screens/tracking/TrackingStates';
import { LIVE_STATUSES, OTP_STATUSES, getRider, shortOrderCode } from '../screens/orders/orderUtils';

const TrackingBottomSheet = ({ order, riderLocation, activeLeg, isHi, onHelp, onViewDetails, onShop, compact = false }) => {
    const status = String(order?.orderStatus || '').toUpperCase();
    const rider = getRider(order);
    const otp = order?.deliveryOtp || order?.otp || null;
    const showOtp = Boolean(otp) && OTP_STATUSES.includes(status);
    const hasLive = Boolean(activeLeg) && LIVE_STATUSES.includes(status);
    const lastFix = order?.tracking?.lastLocationUpdateAt || riderLocation?.timestamp || null;
    const stale = hasLive && lastFix != null && Date.now() - new Date(lastFix).getTime() > 30000;
    const showRider = rider && (LIVE_STATUSES.includes(status) || status === 'DELIVERED');

    const delivered = status === 'DELIVERED';
    const deliveredAt = delivered
        ? order?.actualDeliveryTime || order?.deliveredAt || order?.timeline?.find?.((t) => t.status === 'DELIVERED')?.timestamp || true
        : null;

    const cards = [];
    if (delivered) {
        cards.push(<DeliveredHero key="delivered" isHi={isHi} deliveredAt={deliveredAt === true ? null : deliveredAt} orderCode={shortOrderCode(order)} />);
    } else if (status === 'CANCELLED') {
        cards.push(<CancelledHero key="cancelled" isHi={isHi} onShop={onShop} />);
    }
    if (showOtp) cards.push(<DeliveryOtpCard key="otp" otp={otp} isHi={isHi} />);
    if (!compact) {
        if (showRider) cards.push(<RiderCard key="rider" rider={rider} stale={stale} activeLeg={activeLeg} deliveredAt={deliveredAt} isHi={isHi} />);
        cards.push(<OrderSummaryCard key="summary" order={order} isHi={isHi} onViewDetails={onViewDetails} />);
    }
    cards.push(<HelpRow key="help" isHi={isHi} onPress={onHelp} />);

    return (
        <View style={styles.stack}>
            {cards.map((card, i) => (
                <Animated.View key={card.key} entering={layout.enterAt(i)} exiting={layout.exit} layout={layout.list}>
                    {card}
                </Animated.View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    stack: { gap: space.md },
});

export default TrackingBottomSheet;
