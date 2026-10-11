/**
 * OrdersHistoryScreen — the user's orders as layered cards with status filters.
 * Live orders open tracking; finished ones open the receipt. Reorder refills the cart.
 *
 * Motion
 *   · large "Your orders" title collapses into the solid compact bar on scroll (useCollapsibleHeader)
 *   · skeleton → list → empty / error crossfade (ContentSwap), never a pop
 *   · cards stagger in (35 ms, first 8); switching filter fades out the cards that no longer match,
 *     fades in the new ones and slides the rest into place (Layout Animations, LinearTransition spring)
 *   · chips re-flow with a spring when their counts appear
 * Theme: everything from tokens / useTheme(); light unchanged.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { space } from '../constants/theme';
import { layout, makeStyles } from '../theme';
import {
    AnimatedScreen,
    Card,
    Chip,
    CollapsibleHeader,
    ContentSwap,
    EmptyState,
    LargeTitle,
    Screen,
    Skeleton,
    SkeletonGroup,
    Text,
    toast,
    useCollapsibleHeader,
    useCollapsibleHeaderHeight,
} from '../components/ui';
import { OrderService } from '../services';
import { useTranslation } from '../hooks/useTranslation';
import { OrderCard } from './orders/OrderCard';
import { getOrderId, isActiveOrder, reorderToCart } from './orders/orderUtils';

const FILTERS = [
    { key: 'all', en: 'All', hi: 'सभी' },
    { key: 'active', en: 'Active', hi: 'चालू' },
    { key: 'delivered', en: 'Delivered', hi: 'डिलीवर' },
    { key: 'cancelled', en: 'Cancelled', hi: 'रद्द' },
];

const matches = (order, filter) => {
    const status = String(order?.orderStatus || '').toUpperCase();
    if (filter === 'active') return isActiveOrder(order);
    if (filter === 'delivered') return status === 'DELIVERED';
    if (filter === 'cancelled') return status === 'CANCELLED';
    return true;
};

function OrdersSkeleton() {
    const styles = useStyles();
    return (
        <SkeletonGroup style={styles.skList} gap={space.md}>
            {[0, 1, 2].map((i) => (
                <Card key={i} padding="lg">
                    <View style={styles.skRow}>
                        <Skeleton width={96} height={26} radius="chip" />
                        <Skeleton width={84} height={12} />
                    </View>
                    <View style={[styles.skRow, styles.skMid]}>
                        <View style={styles.skThumbs}>
                            {[0, 1, 2].map((j) => <Skeleton key={j} width={44} height={44} radius="sm" />)}
                        </View>
                        <Skeleton width={64} height={18} />
                    </View>
                    <View style={[styles.skRow, styles.skMid]}>
                        <Skeleton width={72} height={28} radius="button" />
                        <Skeleton width={110} height={36} radius="button" />
                    </View>
                </Card>
            ))}
        </SkeletonGroup>
    );
}

const OrdersHistoryScreen = ({ navigation }) => {
    const styles = useStyles();
    const dispatch = useDispatch();
    const { isHi } = useTranslation();
    const { user } = useSelector((state) => state.auth);
    const cartItems = useSelector((state) => state.cart.items);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [filter, setFilter] = useState('all');
    const collapse = useCollapsibleHeader();
    const top = useCollapsibleHeaderHeight();

    useEffect(() => {
        let active = true;

        const loadOrders = async () => {
            setLoadError(false);
            try {
                if (!user?.id) {
                    setOrders([]);
                    return;
                }

                const response = await OrderService.getOrders(user.id);
                if (!active) return;

                const normalized = Array.isArray(response) ? response : response.orders || [];
                setOrders(normalized);
            } catch (error) {
                console.error('Failed to load order history:', error);
                if (active) {
                    setOrders([]);
                    setLoadError(true);
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadOrders();
        return () => {
            active = false;
        };
    }, [user?.id, reloadKey]);

    const visible = useMemo(() => orders.filter((o) => matches(o, filter)), [orders, filter]);
    const counts = useMemo(
        () => Object.fromEntries(FILTERS.map((f) => [f.key, orders.filter((o) => matches(o, f.key)).length])),
        [orders]
    );

    const openTracking = useCallback((order) => {
        const orderId = getOrderId(order);
        if (orderId) navigation.navigate('OrderTracking', { orderId });
    }, [navigation]);

    const openDetails = useCallback((order) => {
        const orderId = getOrderId(order);
        if (orderId) navigation.navigate('OrderDetails', { orderId });
    }, [navigation]);

    const openOrder = useCallback((order) => (isActiveOrder(order) ? openTracking(order) : openDetails(order)), [openTracking, openDetails]);

    const reorder = useCallback((order) => {
        const units = reorderToCart(dispatch, order, cartItems);
        if (!units) {
            toast.error(isHi ? 'ये सामान अभी उपलब्ध नहीं हैं' : "These items aren't available right now");
            return;
        }
        toast.success(isHi ? `${units} सामान कार्ट में जोड़े गए` : `${units} items added to cart`, {
            action: { label: isHi ? 'कार्ट देखें' : 'View cart', onPress: () => navigation.navigate('Main', { screen: 'Cart' }) },
        });
    }, [dispatch, cartItems, isHi, navigation]);

    const renderItem = useCallback(({ item, index }) => (
        <Animated.View entering={layout.enterAt(index)} exiting={layout.exit} style={styles.item}>
            <OrderCard order={item} isHi={isHi} onOpen={openOrder} onTrack={openTracking} onReorder={reorder} onDetails={openDetails} />
        </Animated.View>
    ), [isHi, openOrder, openTracking, reorder, openDetails, styles.item]);

    const goShopping = () => navigation.navigate('Main', { screen: 'Home' });
    const goBack = () => navigation.goBack();
    const title = isHi ? 'आपके ऑर्डर' : 'Your orders';

    const header = (
        <View>
            <LargeTitle collapse={collapse} title={title} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {FILTERS.map((f) => (
                    <Animated.View key={f.key} layout={layout.list}>
                        <Chip
                            size="sm"
                            label={`${isHi ? f.hi : f.en}${!loading && counts[f.key] ? ` · ${counts[f.key]}` : ''}`}
                            selected={filter === f.key}
                            onPress={() => setFilter(f.key)}
                        />
                    </Animated.View>
                ))}
            </ScrollView>
        </View>
    );

    const listProps = {
        onScroll: collapse.onScroll,
        scrollEventThrottle: 16,
        showsVerticalScrollIndicator: false,
        contentContainerStyle: [styles.list, { paddingTop: top }],
    };

    const retry = () => { setLoading(true); setReloadKey((k) => k + 1); };
    const stateKey = loading ? 'loading' : loadError ? 'error' : orders.length === 0 ? 'empty' : 'list';
    let body;
    if (stateKey === 'loading') {
        body = <Animated.ScrollView {...listProps}>{header}<OrdersSkeleton /></Animated.ScrollView>;
    } else if (stateKey === 'error') {
        body = (
            <Animated.ScrollView {...listProps}>
                {header}
                <EmptyState
                    mood="sad"
                    title={isHi ? 'ऑर्डर लोड नहीं हो सके' : 'Couldn’t load your orders'}
                    subtitle={isHi ? 'इंटरनेट कनेक्शन जांचें और फिर से प्रयास करें।' : 'Check your internet connection and try again.'}
                    actionLabel={isHi ? 'फिर से प्रयास करें' : 'Try again'}
                    onAction={retry}
                />
            </Animated.ScrollView>
        );
    } else if (stateKey === 'empty') {
        body = (
            <Animated.ScrollView {...listProps}>
                {header}
                <EmptyState
                    title={isHi ? 'अभी तक कोई ऑर्डर नहीं' : 'No orders yet'}
                    subtitle={isHi
                        ? 'आपके पिछले ऑर्डर यहाँ दिखेंगे। आज की ज़रूरत के सामान से शुरू करें।'
                        : 'Your past orders will show here. Start with today’s essentials.'}
                    actionLabel={isHi ? 'खरीदारी शुरू करें' : 'Start shopping'}
                    onAction={goShopping}
                />
            </Animated.ScrollView>
        );
    } else {
        body = (
            <Animated.FlatList
                {...listProps}
                ListHeaderComponent={header}
                data={visible}
                renderItem={renderItem}
                keyExtractor={(item, i) => String(getOrderId(item) || i)}
                itemLayoutAnimation={layout.list}
                ListEmptyComponent={
                    <Animated.View key={`none-${filter}`} entering={layout.enter} exiting={layout.exit}>
                        <EmptyState
                            compact
                            title={isHi ? 'इस फ़िल्टर में कोई ऑर्डर नहीं' : 'No orders in this filter'}
                            subtitle={isHi ? 'दूसरा फ़िल्टर चुनें या सभी ऑर्डर देखें।' : 'Pick another filter or see all your orders.'}
                            actionLabel={isHi ? 'सभी ऑर्डर दिखाएँ' : 'Show all orders'}
                            onAction={() => setFilter('all')}
                        />
                    </Animated.View>
                }
            />
        );
    }

    return (
        <Screen edges={[]}>
            <AnimatedScreen>
                <ContentSwap stateKey={stateKey} style={styles.flex}>
                    {body}
                </ContentSwap>
            </AnimatedScreen>
            <CollapsibleHeader collapse={collapse} title={title} onBack={goBack} backLabel={isHi ? 'वापस जाएँ' : 'Go back'} />
        </Screen>
    );
};

const useStyles = makeStyles(() => ({
    flex: { flex: 1 },
    chips: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
    list: { paddingBottom: space['3xl'] },
    item: { paddingHorizontal: space.lg, paddingBottom: space.md },
    skList: { paddingHorizontal: space.lg },
    skRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    skMid: { marginTop: space.lg },
    skThumbs: { flexDirection: 'row', gap: space.xs },
}));

export default OrdersHistoryScreen;
