/**
 * OrderCard — one row of order history: soft status chip + date, thumbnail stack, item count,
 * total, and contextual actions (Track for live orders, outlined Reorder for finished ones).
 * Live orders also show the ETA as a mixed-weight line ("Arriving in **7 mins**").
 *
 * Props: order, isHi, onOpen(order), onTrack(order), onReorder(order), onDetails(order)
 */
import React, { memo } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { space } from '../../constants/theme';
import { press } from '../../theme/motion';
import { makeStyles } from '../../theme';
import { Button, Card, Divider, PressableScale, Text } from '../../components/ui';
import { StatusChip, ThumbStack } from './OrderParts';
import { countItems, formatMoney, formatOrderDate, getBill, getEtaMinutes, getStatusMeta, isActiveOrder } from './orderUtils';

function OrderCardBase({ order, isHi, onOpen, onTrack, onReorder, onDetails }) {
    const styles = useStyles();
    const meta = getStatusMeta(order.orderStatus, isHi);
    const active = isActiveOrder(order);
    const count = countItems(order);
    const total = getBill(order).totalAmount;
    const date = formatOrderDate(order.createdAt, isHi);
    const eta = active ? getEtaMinutes({ order }) : null;

    return (
        <Card padding={0}>
            <PressableScale
                onPress={() => onOpen(order)}
                scaleTo={press.subtle}
                style={styles.main}
                accessibilityLabel={`${isHi ? 'ऑर्डर' : 'Order'} ${order.orderId || ''}, ${meta.label}, ${formatMoney(total)}`}
            >
            <View style={styles.top}>
                <StatusChip status={order.orderStatus} isHi={isHi} />
                <Text variant="caption" color="muted" numberOfLines={1} style={styles.date}>{date}</Text>
            </View>

            {active && Number.isFinite(eta) ? (
                <Text variant="body" color="secondary" style={styles.eta}>
                    {isHi
                        ? <><Text variant="bodyStrong" color="ink">{eta} मिनट</Text> में पहुँचेगा</>
                        : <>Arriving in <Text variant="bodyStrong" color="ink">{eta} {eta === 1 ? 'min' : 'mins'}</Text></>}
                </Text>
            ) : null}

            <View style={styles.mid}>
                <ThumbStack items={order.items || []} max={4} size={48} />
                <View style={styles.sum}>
                    <Text variant="priceLarge">{formatMoney(total)}</Text>
                    <Text variant="caption" color="muted">
                        {count} {isHi ? 'सामान' : count === 1 ? 'item' : 'items'}
                    </Text>
                </View>
            </View>
            </PressableScale>

            <Divider />

            <View style={styles.actions}>
                <Button
                    variant="ghost"
                    size="sm"
                    label={isHi ? 'विवरण देखें' : 'View details'}
                    onPress={() => onDetails(order)}
                    rightIcon={({ color, size }) => <MaterialCommunityIcons name="chevron-right" color={color} size={size} />}
                />
                {active ? (
                    <Button
                        size="sm"
                        label={isHi ? 'ट्रैक करें' : 'Track order'}
                        onPress={() => onTrack(order)}
                        leftIcon={({ color, size }) => <MaterialCommunityIcons name="map-marker-path" color={color} size={size} />}
                    />
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        label={isHi ? 'फिर से मँगाएँ' : 'Reorder'}
                        onPress={() => onReorder(order)}
                        leftIcon={({ color, size }) => <MaterialCommunityIcons name="refresh" color={color} size={size} />}
                    />
                )}
            </View>
        </Card>
    );
}

export const OrderCard = memo(OrderCardBase);

const useStyles = makeStyles(() => ({
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
    date: { flexShrink: 1 },
    eta: { marginTop: space.md },
    mid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md, gap: space.md },
    sum: { alignItems: 'flex-end', gap: space.xxs },
    main: { padding: space.lg },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: space.xs, paddingRight: space.md, paddingVertical: space.sm },
}));

export default OrderCard;
