/**
 * OrderSummaryCard — collapsed: thumbnails + item count + total. Expanded: items, bill, address.
 * The chevron turns with a spring; the details fade in (no height animation).
 *
 * Props: order, isHi, onViewDetails
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useDerivedValue, withSpring } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../../constants/theme';
import { makeStyles, useTheme } from '../../theme';
import { springs, durations } from '../../theme/motion';
import { Button, Card, Divider, PressableScale, Text } from '../../components/ui';
import { BillRows, OrderItemRow, ThumbStack } from '../orders/OrderParts';
import { countItems, formatMoney, getAddressText, getBill } from '../orders/orderUtils';

export function OrderSummaryCard({ order, isHi, onViewDetails }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const [open, setOpen] = useState(false);
    const count = countItems(order);
    const total = getBill(order).totalAmount;
    const address = getAddressText(order);
    const turn = useDerivedValue(() => withSpring(open ? 180 : 0, springs.snappy), [open]);
    const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

    return (
        <Card radius="lg" padding={0}>
            <PressableScale
                scaleTo={0.99}
                haptic="selection"
                onPress={() => setOpen((v) => !v)}
                style={styles.head}
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${isHi ? 'ऑर्डर सारांश' : 'Order summary'}, ${count} ${isHi ? 'सामान' : 'items'}, ${formatMoney(total)}`}
            >
                <ThumbStack items={order?.items || []} max={3} size={36} />
                <View style={styles.headText}>
                    <Text variant="title">{isHi ? 'ऑर्डर सारांश' : 'Order summary'}</Text>
                    <Text variant="caption" color="muted">
                        {count} {isHi ? 'सामान' : count === 1 ? 'item' : 'items'} · {formatMoney(total)}
                    </Text>
                </View>
                <Animated.View style={chevron}>
                    <MaterialCommunityIcons name="chevron-down" size={24} color={colors.inkSecondary} />
                </Animated.View>
            </PressableScale>

            {open ? (
                <Animated.View entering={FadeIn.duration(durations.base)} exiting={FadeOut.duration(durations.fast)} style={styles.body}>
                    <Divider />
                    <View>
                        {(order?.items || []).map((item, i) => (
                            <OrderItemRow key={`${item.productId || item.name}-${i}`} item={item} index={i} />
                        ))}
                    </View>
                    <Divider variant="dashed" />
                    <BillRows order={order} isHi={isHi} />
                    {address ? (
                        <>
                            <Divider />
                            <View style={styles.addr}>
                                <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.inkSecondary} />
                                <View style={styles.headText}>
                                    <Text variant="label">{isHi ? 'डिलीवरी पता' : 'Delivering to'} {order?.deliveryAddress?.type || ''}</Text>
                                    <Text variant="caption" color="muted">{address}</Text>
                                </View>
                            </View>
                        </>
                    ) : null}
                    {onViewDetails ? (
                        <Button variant="ghost" size="sm" label={isHi ? 'पूरी रसीद देखें' : 'View full receipt'} onPress={onViewDetails} align="start" />
                    ) : null}
                </Animated.View>
            ) : null}
        </Card>
    );
}

const useStyles = makeStyles(() => ({
    head: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: 72 },
    headText: { flex: 1, gap: space.xxs },
    body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
    addr: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
}));

export default OrderSummaryCard;
