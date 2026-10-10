/**
 * OrderDetailsScreen — receipt for one order: status + store header, items, bill,
 * delivery address, payment, status timeline, then help / reorder / track actions.
 *
 * Motion: "Order details" large title collapses into the frosted bar on scroll; skeleton → receipt
 * (or the error state) crossfades; the sections rise in staggered (35 ms apart); the action footer
 * rises in once the order is there. Theme: tokens / useTheme() only.
 */
import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, space } from '../constants/theme';
import { layout, makeStyles, useTheme } from '../theme';
import {
    AnimatedScreen,
    Badge,
    Button,
    Card,
    CollapsibleHeader,
    ContentSwap,
    Divider,
    EmptyState,
    LargeTitle,
    Screen,
    Skeleton,
    SkeletonGroup,
    SkeletonText,
    Text,
    toast,
    useCollapsibleHeader,
    useCollapsibleHeaderHeight,
} from '../components/ui';
import { OrderService, SettingsService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { BillRows, OrderItemRow, Perforation, StatusChip } from './orders/OrderParts';
import {
    countItems,
    formatMoney,
    formatOrderDate,
    getBill,
    formatTime,
    getAddressText,
    getOrderId,
    isActiveOrder,
    paymentLabel,
    reorderToCart,
} from './orders/orderUtils';

const TIMELINE_LABELS = {
    PENDING: ['Order placed', 'ऑर्डर दिया गया'],
    CONFIRMED: ['Confirmed by store', 'स्टोर ने पुष्टि की'],
    ASSIGNED: ['Delivery partner assigned', 'डिलीवरी पार्टनर तय'],
    PACKED: ['Packed', 'पैक हुआ'],
    PICKED_UP: ['Picked up', 'उठाया गया'],
    OUT_FOR_DELIVERY: ['Out for delivery', 'डिलीवरी के लिए निकला'],
    ARRIVED: ['Arrived', 'पहुँच गया'],
    DELIVERED: ['Delivered', 'डिलीवर हुआ'],
    CANCELLED: ['Cancelled', 'रद्द'],
};

/** Flat card section with a plain title (`icon` is accepted and ignored: no decorative icon tiles). */
const Section = ({ title, children }) => {
    const styles = useStyles();
    return (
        <Card padding="lg">
            <Text variant="title" accessibilityRole="header" style={styles.sectionHead}>{title}</Text>
            {children}
        </Card>
    );
};

/** Staggered section entrance (first paint of the receipt only). */
const Rise = ({ i, children }) => <Animated.View entering={layout.enterAt(i)}>{children}</Animated.View>;

function Timeline({ entries, isHi }) {
    const styles = useStyles();
    const { colors } = useTheme();
    return (
        <View style={styles.timeline}>
            {entries.map((entry, i) => {
                const last = i === entries.length - 1;
                const cancelled = entry.status === 'CANCELLED';
                const label = TIMELINE_LABELS[entry.status] || [entry.status, entry.status];
                return (
                    <View key={`${entry.status}-${i}`} style={styles.tlRow}>
                        <View style={styles.tlRail}>
                            <View style={[styles.tlDot, { backgroundColor: cancelled ? colors.error : last ? colors.ink : colors.borderStrong }]} />
                            {!last ? <View style={styles.tlLine} /> : null}
                        </View>
                        <View style={styles.tlText}>
                            <Text variant="label" color={cancelled ? 'error' : 'ink'}>{isHi ? label[1] : label[0]}</Text>
                            {entry.timestamp ? <Text variant="caption" color="muted">{formatTime(entry.timestamp, isHi)}</Text> : null}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

function DetailsSkeleton() {
    const styles = useStyles();
    return (
        <SkeletonGroup style={styles.content} gap={space.md}>
            <Card><SkeletonText lines={3} lastLineWidth="40%" /></Card>
            <Card>
                {[0, 1, 2].map((i) => (
                    <View key={i} style={styles.skItem}>
                        <Skeleton width={48} height={48} radius="sm" />
                        <SkeletonText lines={2} style={styles.flex} />
                    </View>
                ))}
            </Card>
            <Card><SkeletonText lines={4} lastLineWidth="50%" /></Card>
        </SkeletonGroup>
    );
}

const OrderDetailsScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const collapse = useCollapsibleHeader();
    const top = useCollapsibleHeaderHeight();
    const { orderId } = route.params || {};
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const { isHi } = useTranslation();
    const cartItems = useSelector((state) => state.cart.items);
    const [order, setOrder] = useState(null);
    const [store, setStore] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const [orderResponse, storeResponse] = await Promise.all([
                    OrderService.getOrderById(orderId),
                    SettingsService.getStoreSettings(),
                ]);

                if (!active) return;
                setOrder(orderResponse?.order || orderResponse || null);
                setStore(storeResponse?.settings || storeResponse || null);
            } catch (error) {
                if (active) {
                    setOrder(null);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        if (orderId) {
            load();
        } else {
            setLoading(false);
        }

        return () => {
            active = false;
        };
    }, [orderId]);

    const back = () => navigation.goBack();
    const title = isHi ? 'ऑर्डर विवरण' : 'Order details';

    const backLabel = isHi ? 'वापस जाएँ' : 'Go back';
    const scrollProps = {
        onScroll: collapse.onScroll,
        scrollEventThrottle: 16,
        showsVerticalScrollIndicator: false,
    };
    // One shell for every state, so loading → receipt / error is a crossfade under a steady header.
    const shell = (stateKey, content, footer = null) => (
        <Screen edges={[]}>
            <AnimatedScreen>
                <ContentSwap stateKey={stateKey} style={styles.flex}>
                    {content}
                </ContentSwap>
            </AnimatedScreen>
            <CollapsibleHeader collapse={collapse} title={title} onBack={back} backLabel={backLabel} />
            {footer}
        </Screen>
    );

    if (loading) {
        return shell(
            'loading',
            <Animated.ScrollView {...scrollProps} contentContainerStyle={{ paddingTop: top }}>
                <LargeTitle collapse={collapse} title={title} />
                <DetailsSkeleton />
            </Animated.ScrollView>,
        );
    }

    if (!order) {
        return shell(
            'error',
            <Animated.ScrollView {...scrollProps} contentContainerStyle={{ paddingTop: top }}>
                <LargeTitle collapse={collapse} title={title} />
                <EmptyState
                    mood="sad"
                    title={isHi ? 'ऑर्डर लोड नहीं हो सका' : "We couldn't load this order"}
                    subtitle={isHi ? 'इंटरनेट जाँचें और फिर कोशिश करें।' : 'Check your connection and try again.'}
                    actionLabel={backLabel}
                    onAction={back}
                />
            </Animated.ScrollView>,
        );
    }

    const active = isActiveOrder(order);
    const count = countItems(order);
    const address = getAddressText(order);
    const timeline = Array.isArray(order.timeline) ? order.timeline.filter((t) => t?.status) : [];

    const onHelp = () => {
        if (store?.contactPhone) Linking.openURL(`tel:${store.contactPhone}`);
        else toast.info(isHi ? 'सहायता जल्द उपलब्ध होगी' : 'Support will be available shortly');
    };
    const onReorder = () => {
        const units = reorderToCart(dispatch, order, cartItems);
        if (!units) {
            toast.error(isHi ? 'ये सामान अभी उपलब्ध नहीं हैं' : "These items aren't available right now");
            return;
        }
        toast.success(isHi ? `${units} सामान कार्ट में जोड़े गए` : `${units} items added to cart`);
        navigation.navigate('Main', { screen: 'Cart' });
    };

    return shell(
        'data',
            <Animated.ScrollView {...scrollProps} contentContainerStyle={{ paddingTop: top, paddingBottom: space['3xl'] + 72 + insets.bottom }}>
                <LargeTitle collapse={collapse} title={title} subtitle={order.orderId} />
                <View style={styles.content}>
                {/* Receipt */}
                <Rise i={0}>
                <Card padding={0} style={styles.receipt}>
                    <View style={styles.receiptHead}>
                        <View style={styles.headRow}>
                            <StatusChip status={order.orderStatus} isHi={isHi} />
                            <Text variant="caption" color="muted">
                                {formatOrderDate(order.createdAt, isHi) || (isHi ? 'समय उपलब्ध नहीं' : 'Order time unavailable')}
                            </Text>
                        </View>
                        <Text variant="priceHero" style={styles.total}>{formatMoney(getBill(order).totalAmount)}</Text>
                        <Text variant="body" color="secondary">
                            {count} {isHi ? 'सामान' : count === 1 ? 'item' : 'items'} · {paymentLabel(order.paymentMethod, isHi)}
                        </Text>
                    </View>
                    <Perforation />
                    <View style={styles.receiptBody}>
                        <View>
                            {(order.items || []).map((item, i) => (
                                <OrderItemRow key={`${item.productId || item.name}-${i}`} item={item} index={i} />
                            ))}
                        </View>
                        <Divider variant="dashed" />
                        <BillRows order={order} isHi={isHi} showGst />
                    </View>
                </Card>
                </Rise>

                <Rise i={1}>
                <Card padding="lg">
                    <View style={styles.storeRow}>
                        <View style={styles.storeMark}>
                            <MaterialCommunityIcons name="storefront-outline" size={20} color={colors.inkSecondary} />
                        </View>
                        <View style={styles.flex}>
                            <Text variant="title" numberOfLines={1}>{store?.storeName || 'Shravan Kirana Store'}</Text>
                            <Text variant="caption" color="muted" numberOfLines={2}>
                                {store?.location?.address || (isHi ? 'स्टोर का पता उपलब्ध नहीं' : 'Store address unavailable')}
                            </Text>
                        </View>
                    </View>
                </Card>
                </Rise>

                <Rise i={2}>
                <Section icon="map-marker-outline" title={isHi ? 'डिलीवरी पता' : 'Delivery address'}>
                    <Text variant="bodyStrong">{order.userId?.name || order.deliveryAddress?.type || (isHi ? 'ग्राहक' : 'Customer')}</Text>
                    <Text variant="body" color="secondary">{address || '—'}</Text>
                    {order.userId?.phone ? <Text variant="caption" color="muted">{order.userId.phone}</Text> : null}
                </Section>
                </Rise>

                <Rise i={3}>
                <Section icon="credit-card-outline" title={isHi ? 'भुगतान' : 'Payment'}>
                    <View style={styles.payRow}>
                        <Text variant="body">{paymentLabel(order.paymentMethod, isHi)}</Text>
                        {order.paymentStatus ? (
                            ['PAID', 'COMPLETED', 'SUCCESS'].includes(String(order.paymentStatus).toUpperCase()) ? (
                                <Badge tone="success" label={isHi ? 'भुगतान हुआ' : 'Paid'} />
                            ) : (
                                <Badge tone="neutral" label={String(order.paymentStatus).charAt(0).toUpperCase() + String(order.paymentStatus).slice(1).toLowerCase()} />
                            )
                        ) : null}
                    </View>
                </Section>
                </Rise>

                {timeline.length ? (
                    <Rise i={4}>
                    <Section icon="timeline-clock-outline" title={isHi ? 'ऑर्डर की स्थिति' : 'Order status'}>
                        <Timeline entries={timeline} isHi={isHi} />
                    </Section>
                    </Rise>
                ) : null}
                </View>
            </Animated.ScrollView>,

            <Animated.View entering={layout.enter} style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
                <Button
                    variant="outline"
                    label={isHi ? 'मदद' : 'Get help'}
                    onPress={onHelp}
                    leftIcon={({ color, size }) => <MaterialCommunityIcons name="headset" color={color} size={size} />}
                    style={styles.flex}
                />
                {active ? (
                    <Button
                        label={isHi ? 'ट्रैक करें' : 'Track order'}
                        onPress={() => navigation.navigate('OrderTracking', { orderId: getOrderId(order) })}
                        style={styles.flex}
                    />
                ) : (
                    <Button label={isHi ? 'फिर से मँगाएँ' : 'Reorder'} onPress={onReorder} style={styles.flex} />
                )}
            </Animated.View>,
    );
};

const useStyles = makeStyles((t) => ({
    flex: { flex: 1 },
    content: { paddingHorizontal: space.lg, gap: space.md },
    receipt: { overflow: 'hidden' },
    receiptHead: { padding: space.lg, paddingBottom: space.md, gap: space.xxs },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.sm },
    total: { marginTop: space.xs },
    storeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    storeMark: {
        width: 44,
        height: 44,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptBody: { paddingHorizontal: space.lg, paddingBottom: space.lg, paddingTop: space.xs, gap: space.md },
    sectionHead: { marginBottom: space.sm },
    payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timeline: { paddingTop: space.xs },
    tlRow: { flexDirection: 'row', gap: space.md },
    tlRail: { width: 12, alignItems: 'center' },
    tlDot: { width: 10, height: 10, borderRadius: radii.pill, marginTop: 4 },
    tlLine: { flex: 1, width: 2, backgroundColor: t.colors.hairline, marginVertical: space.xxs },
    tlText: { flex: 1, paddingBottom: space.md },
    skItem: { flexDirection: 'row', gap: space.md, alignItems: 'center', marginBottom: space.md },
    footer: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        backgroundColor: t.colors.surface,
        ...t.shadows.lg,
        ...(t.isDark ? t.highlightTop : null),
    },
}));

export default OrderDetailsScreen;
