/**
 * Checkout (also rendered by the Cart tab). State and the order/payment flow live in
 * screens/checkout/useCheckout.js; this file only lays the pieces out.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTabBarHeight } from '../components/BottomTabsIcons';
import {
    AnimatedScreen,
    BottomSheet,
    Button,
    ContentSwap,
    Divider,
    EmptyState,
    IconButton,
    KeyboardLift,
    PressableScale,
    Screen,
    Text,
    toast,
    useKeyboardSpring,
} from '../components/ui';
import { HIT, radii, space, z } from '../constants/theme';
import { layout, makeStyles, useTheme } from '../theme';
import { press } from '../theme/motion';
import { hydrateCart, removeFromCart } from '../store/slices/cartSlice';
import { useCheckout } from './checkout/useCheckout';
import { DeliveryEtaCard } from './checkout/DeliveryEtaCard';
import { DeliveryAddressCard } from './checkout/DeliveryAddressCard';
import { CheckoutItemRow } from './checkout/CheckoutItemRow';
import { OffersCard } from './checkout/OffersCard';
import { GROUP_RADIUS, ICON_CIRCLE } from './checkout/layout';
import { FreeDeliveryNudge } from './checkout/FreeDeliveryNudge';
import { UnavailableItemsCard } from './checkout/UnavailableItemsCard';
import { SuggestionsRail } from './checkout/SuggestionsRail';
import { ExtrasCard } from './checkout/ExtrasCard';
import { productId, useCheckoutProducts, useGapFillers } from './checkout/useCheckoutProducts';
import { BillSummary } from './checkout/BillSummary';
import { PlaceOrderBar } from './checkout/PlaceOrderBar';
import { AddressSheet } from './checkout/AddressSheet';
import { PaymentMethodSheet } from './checkout/PaymentMethodSheet';
import { PaymentStatusOverlay } from './checkout/PaymentStatusOverlay';
import { PayUWebViewModal } from './checkout/PayUWebViewModal';

const UNDO_MS = 4000;
// Reanimated web animates a container's SIZE change by scaling it (text distorts), so containers
// whose height changes only spring on native; on web they snap while their rows still slide.
const sizeLayout = Platform.OS === 'web' ? undefined : layout.list;

const CheckoutScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const { colors } = useTheme();
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const c = useCheckout({ navigation, route });
    const { isHi } = c;
    // Delivery time only from the store settings (null while unknown) and only while the store is open.
    const etaMinutes = c.store.isOpen ? c.store.etaMinutes : null;
    const closedLine = c.store.isOpen ? null : c.store.closedLine(isHi);

    const [addressSheet, setAddressSheet] = useState(false);
    const [paymentSheet, setPaymentSheet] = useState(false);
    const [clearSheet, setClearSheet] = useState(false);
    const [barHeight, setBarHeight] = useState(220);

    const inTab = route?.name === 'Cart';
    // Blinkit/Zepto pattern: the floating dock hides while the Cart tab has items (back arrow
    // returns to the previous tab); with an empty cart the dock is back for browsing.
    const hideDock = inTab && c.hasItems;
    useEffect(() => {
        if (!inTab) return;
        navigation.setOptions({ tabBarStyle: hideDock ? { display: 'none' } : undefined });
    }, [inTab, hideDock, navigation]);
    useFocusEffect(useCallback(() => {
        if (inTab) DeviceEventEmitter.emit('SET_TAB_BAR_VISIBLE', !hideDock);
    }, [inTab, hideDock]));
    const dockHeight = useTabBarHeight();
    const barOffset = inTab ? dockHeight : 0; // empty state keeps clear of the dock
    const barBottomPad = insets.bottom;

    // Catalogue for the free-delivery rail and "You might also like" (one request).
    const products = useCheckoutProducts();
    const [initialCartIds] = useState(() => new Set(c.cartItems.map((i) => String(i.productId || i.id))));
    const fillers = useGapFillers(products, initialCartIds, c.bill?.freeDeliveryGap || 0);
    const suggestionExclude = useMemo(
        () => new Set([...initialCartIds, ...fillers.map(productId)]),
        [initialCartIds, fillers],
    );

    // "View bill" in the pay bar scrolls the bill summary into view.
    const scrollRef = useRef(null);
    const billY = useRef(0); // bill's offset inside the stack below
    const stackY = useRef(0); // the stack's offset in the scroll content
    const viewBill = useCallback(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, stackY.current + billY.current - space.md), animated: true });
    }, []);

    // The pay sheet rides the keyboard (tip / instructions inputs); whatever it covers becomes
    // extra scroll room so the focused field can always be scrolled clear.
    const { height: kb } = useKeyboardSpring();
    const keyboardRoom = useAnimatedStyle(() => ({ height: Math.max(0, kb.value - barBottomPad) }));

    // Swipe-to-remove a line, with Undo (puts the line back where it was, same quantity).
    const onRemoveItem = useCallback((item, index) => {
        dispatch(removeFromCart(item.id));
        toast.show({
            message: isHi ? 'सामान हटा दिया गया' : `Removed ${item.name}`,
            duration: UNDO_MS,
            bottomOffset: Math.max(0, barHeight - insets.bottom) + space.sm,
            action: {
                label: isHi ? 'वापस लाएं' : 'Undo',
                onPress: () => dispatch((d, getState) => {
                    const items = getState().cart.items;
                    if (items.some((i) => i.id === item.id)) return;
                    const next = [...items];
                    next.splice(Math.min(index, next.length), 0, item);
                    d(hydrateCart({ items: next }));
                }),
            },
        });
    }, [barHeight, dispatch, insets.bottom, isHi]);

    // Amount shown in the status overlay. Frozen while the overlay is up, because
    // a successful payment clears the cart underneath it.
    const amountRef = useRef(c.hasItems ? c.payableAmount : null);
    if (!c.isProcessingPayment && c.hasItems) amountRef.current = c.payableAmount;
    const refusedById = Object.fromEntries(c.refusedItems.map((r) => [r.id, r.reason]));

    // Slide-to-pay springs back whenever the flow ends without leaving the screen.
    const sliderRef = useRef(null);
    const armedRef = useRef(false);
    // Set once the user starts a payment here; a web return from PayU remounts the
    // screen without knowing which method was used, so the overlay omits it then.
    const startedHereRef = useRef(false);
    const onConfirm = useCallback(async () => {
        armedRef.current = true;
        startedHereRef.current = true;
        const started = await c.handleInitiatePayment();
        if (started === false) {
            armedRef.current = false;
            sliderRef.current?.reset();
        }
    }, [c.handleInitiatePayment]);

    useEffect(() => {
        if (armedRef.current && !c.isProcessingPayment && !c.payuRequest && !c.isPlacing) {
            armedRef.current = false;
            sliderRef.current?.reset();
        }
    }, [c.isProcessingPayment, c.payuRequest, c.isPlacing]);

    const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));
    const goShopping = () => navigation.navigate('Home');
    const openProduct = useCallback((product) => navigation.navigate('ProductDetail', { product }), [navigation]);

    const addNewAddress = () => {
        setAddressSheet(false);
        navigation.navigate('AddAddress');
    };
    // Edit opens the form on this address; saving returns here with it selected.
    const editAddress = useCallback((address) => {
        if (!address) return;
        setAddressSheet(false);
        navigation.navigate('AddAddress', { editAddress: address });
    }, [navigation]);
    // No saved addresses yet: straight to the form; otherwise pick one from the sheet.
    const addOrPickAddress = () => {
        if (c.savedAddresses.length === 0 && !c.isFetchingAddresses) addNewAddress();
        else setAddressSheet(true);
    };
    const openMap = () => {
        setAddressSheet(false);
        navigation.navigate('Location');
    };

    const confirmClear = () => {
        setClearSheet(false);
        c.clearCartItems();
    };

    const overlays = (
        <>
            <PaymentStatusOverlay
                visible={c.isProcessingPayment}
                step={c.paymentStep}
                amount={amountRef.current}
                methodName={startedHereRef.current ? c.paymentOption.name : null}
                isCod={c.selectedPayment === 'cod'}
                onCancel={c.cancelPaymentProcess}
                onCheckAgain={c.checkAgain}
                onCloseVerification={c.closeVerification}
                onRetry={c.retryPayment}
                onPayOnDelivery={c.switchToCod}
                onDismissFailure={c.dismissFailure}
                etaMinutes={etaMinutes}
                isHi={isHi}
            />
            {Platform.OS !== 'web' ? (
                <PayUWebViewModal
                    request={c.payuRequest}
                    onClose={c.handlePayuClosed}
                    onShouldStartLoad={c.handlePayuNavigation}
                    onPayuReturn={c.handlePayuReturn}
                    isHi={isHi}
                />
            ) : null}
        </>
    );

    const header = (
        <View style={styles.header}>
            {/* the dock is hidden while the cart has items, so the Cart tab gets a back arrow too */}
            {inTab && !c.hasItems ? (
                <View style={styles.headerSpacer} />
            ) : (
                <IconButton name="arrow-left" variant="ghost" accessibilityLabel={isHi ? 'वापस जाएं' : 'Go back'} onPress={goBack} />
            )}
            <Text variant="h3" accessibilityRole="header" style={styles.headerTitle}>
                {isHi ? 'चेकआउट' : 'Checkout'}
            </Text>
            <View style={styles.headerSpacer} />
        </View>
    );

    const empty = (
        <View style={[styles.empty, { paddingBottom: barOffset }]}>
            <EmptyState
                title={isHi ? 'आपकी कार्ट खाली है' : 'Your cart is empty'}
                subtitle={
                    etaMinutes
                        ? isHi
                            ? `अभी कुछ नहीं जोड़ा गया। आज की ज़रूरत का सामान जोड़ें, हम लगभग ${etaMinutes} मिनट में पहुँचा देंगे।`
                            : `Nothing added yet. Add today’s essentials and we’ll deliver in about ${etaMinutes} minutes.`
                        : isHi
                          ? 'अभी कुछ नहीं जोड़ा गया। आज की ज़रूरत का सामान जोड़ें।'
                          : 'Nothing added yet. Add today’s essentials to get started.'
                }
                actionLabel={isHi ? 'खरीदारी शुरू करें' : 'Start shopping'}
                onAction={goShopping}
            />
        </View>
    );

    const body = c.hasItems ? (
        <View style={styles.flex}>
            <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={[styles.content, { paddingBottom: barHeight + space.xl }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.gutter}>
                    <DeliveryEtaCard minutes={etaMinutes} closedLine={closedLine} itemCount={c.totalItems} isHi={isHi}>
                        {c.bill ? (
                            <FreeDeliveryNudge
                                itemTotal={c.bill.itemTotal}
                                gap={c.bill.freeDeliveryGap}
                                threshold={c.bill.freeDeliveryThreshold}
                                fillers={fillers}
                                isHi={isHi}
                            />
                        ) : null}
                    </DeliveryEtaCard>
                </View>

                {c.refusedItems.length ? (
                    <Animated.View entering={layout.enter} exiting={layout.exit} layout={sizeLayout} style={styles.gutter}>
                        <UnavailableItemsCard items={c.refusedItems} onRemove={c.removeRefusedItems} isHi={isHi} />
                    </Animated.View>
                ) : null}

                <View style={styles.gutter}>
                    {/* Grouped items card. Its height springs with the rows (layout.list) instead of jumping. */}
                    <Animated.View layout={sizeLayout} style={styles.itemsCard}>
                        <View style={[styles.itemsHead, styles.inset]}>
                            <Text variant="title" accessibilityRole="header">{isHi ? 'आपका ऑर्डर' : 'Your items'}</Text>
                            <Text variant="caption" color="muted">
                                {isHi ? `${c.totalItems} सामान` : `${c.totalItems} item${c.totalItems === 1 ? '' : 's'}`}
                            </Text>
                        </View>
                        {c.cartItems.map((item, index) => (
                            <CheckoutItemRow
                                key={item.id}
                                item={item}
                                index={index}
                                showDivider={index > 0}
                                refusedReason={refusedById[item.id]}
                                onRemove={onRemoveItem}
                                isHi={isHi}
                            />
                        ))}
                        <Animated.View layout={layout.list} style={styles.inset}>
                            <Divider />
                            <PressableScale
                                onPress={goShopping}
                                haptic="light"
                                scaleTo={press.subtle}
                                accessibilityLabel={isHi ? 'और सामान जोड़ें' : 'Add more items'}
                                style={styles.addMore}
                            >
                                <View style={styles.addMoreIcon}>
                                    <MaterialCommunityIcons name="plus" size={18} color={colors.brandText} />
                                </View>
                                <View style={styles.addMoreTexts}>
                                    <Text variant="label" color={colors.brandStrong}>{isHi ? 'और सामान जोड़ें' : 'Add more items'}</Text>
                                    <Text variant="caption" color="muted">{isHi ? 'कुछ भूल गए?' : 'Missed something?'}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.inkMuted} />
                            </PressableScale>
                            <Divider />
                            <PressableScale
                                onPress={() => setClearSheet(true)}
                                haptic="light"
                                scaleTo={press.subtle}
                                accessibilityLabel={isHi ? 'कार्ट खाली करें' : 'Clear cart'}
                                style={styles.clear}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.inkMuted} />
                                <Text variant="label" color="muted">{isHi ? 'कार्ट खाली करें' : 'Clear cart'}</Text>
                            </PressableScale>
                        </Animated.View>
                    </Animated.View>
                </View>

                <Animated.View layout={sizeLayout} style={styles.gutter}>
                    <DeliveryAddressCard
                        address={c.selectedAddress}
                        loading={c.isFetchingAddresses}
                        distanceKm={c.addressInfo.distanceKm}
                        store={c.addressInfo.store}
                        coords={c.addressInfo.coords}
                        outOfArea={c.addressInfo.outOfArea}
                        radiusKm={c.addressInfo.radiusKm}
                        onChange={() => setAddressSheet(true)}
                        onEdit={() => editAddress(c.selectedAddress)}
                        onAdd={addOrPickAddress}
                        isHi={isHi}
                    />
                </Animated.View>

                <Animated.View layout={sizeLayout}>
                    <SuggestionsRail products={products} excludeIds={suggestionExclude} onOpenProduct={openProduct} isHi={isHi} />
                </Animated.View>

                {/* plain wrapper: its onLayout gives the stack's offset in the scroll content (for "View bill") */}
                <View onLayout={(e) => { stackY.current = e.nativeEvent.layout.y; }}>
                <Animated.View layout={sizeLayout} style={[styles.gutter, styles.stack]}>
                    <OffersCard discount={c.bill?.discount} rate={c.bill?.discountRate} isHi={isHi} />
                    <View onLayout={(e) => { billY.current = e.nativeEvent.layout.y; }}>
                        <BillSummary bill={c.bill} tip={c.tip} state={c.billState} isHi={isHi} />
                    </View>
                    <ExtrasCard
                        tip={c.tip}
                        onChangeTip={c.setTip}
                        selected={c.selectedInstructions}
                        onToggle={c.toggleInstruction}
                        note={c.customInstruction}
                        onChangeNote={c.setCustomInstruction}
                        isHi={isHi}
                    />
                    <View style={styles.policy}>
                        <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.inkMuted} />
                        <Text variant="caption" color="muted" style={styles.flex}>
                            {isHi
                                ? 'सुरक्षित भुगतान। पैक होने से पहले ऑर्डर रद्द कर सकते हैं।'
                                : 'Secure payments. You can cancel before your order is packed.'}
                        </Text>
                    </View>
                </Animated.View>
                </View>
                <Animated.View style={keyboardRoom} />
            </ScrollView>

            {/* Sticky pay sheet — rides the keyboard on the UI thread */}
            <KeyboardLift
                offset={barBottomPad}
                onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
                style={[styles.barDock, { pointerEvents: 'box-none' }]}
            >
                <PlaceOrderBar
                    ref={sliderRef}
                    paymentOption={c.paymentOption}
                    onChangePayment={() => setPaymentSheet(true)}
                    amount={c.payableAmount}
                    estimate={c.bill?.grandTotal ?? null}
                    onViewBill={viewBill}
                    billState={c.billState}
                    onRetryQuote={c.retryQuote}
                    isCod={c.selectedPayment === 'cod'}
                    onConfirm={onConfirm}
                    blockedReason={closedLine || c.addressBlock || (c.selectedAddress
                        ? null
                        : (isHi ? 'ऑर्डर से पहले डिलीवरी पता जोड़ें' : 'Add a delivery address to continue'))}
                    bottomPad={barBottomPad}
                    isHi={isHi}
                />
            </KeyboardLift>
        </View>
    ) : empty;

    return (
        <Screen>
            <AnimatedScreen replayOnFocus={inTab}>
                {header}
                {/* items ⇄ empty crossfade (last line removed, cart cleared, order placed) */}
                <ContentSwap stateKey={c.hasItems ? 'items' : 'empty'} style={styles.flex}>
                    {body}
                </ContentSwap>
            </AnimatedScreen>

            {c.hasItems ? (
                <>
                    <AddressSheet
                        visible={addressSheet}
                        onClose={() => setAddressSheet(false)}
                        addresses={c.savedAddresses}
                        selected={c.selectedAddress}
                        onSelect={c.selectAddress}
                        onAddNew={addNewAddress}
                        onEdit={editAddress}
                        onOpenMap={openMap}
                        loading={c.isFetchingAddresses}
                        isHi={isHi}
                    />

                    <PaymentMethodSheet
                        visible={paymentSheet}
                        onClose={() => setPaymentSheet(false)}
                        selected={c.selectedPayment}
                        onSelect={c.setSelectedPayment}
                        amount={c.payableAmount}
                        isHi={isHi}
                    />

                    <BottomSheet
                        visible={clearSheet}
                        onClose={() => setClearSheet(false)}
                        title={isHi ? 'कार्ट खाली करें?' : 'Clear your cart?'}
                        subtitle={isHi ? 'सभी सामान कार्ट से हटा दिए जाएंगे।' : 'All items will be removed from your cart.'}
                        floating
                        footer={(
                            <View style={styles.sheetActions}>
                                <Button label={isHi ? 'रहने दें' : 'Keep items'} variant="outline" style={styles.flex} onPress={() => setClearSheet(false)} />
                                <Button label={isHi ? 'हाँ, खाली करें' : 'Clear cart'} variant="danger" style={styles.flex} onPress={confirmClear} />
                            </View>
                        )}
                    />
                </>
            ) : null}

            {overlays}
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: space.xs,
        paddingRight: space.md,
        minHeight: HIT + space.sm,
    },
    headerTitle: { flex: 1, textAlign: 'center' },
    headerSpacer: { width: HIT },
    empty: { flex: 1, justifyContent: 'center' },
    scroll: { flex: 1 },
    content: { paddingTop: space.xs, gap: space.md },
    gutter: { paddingHorizontal: space.lg },
    stack: { gap: space.md },
    // Same paint as <Card padding={0} radius={GROUP_RADIUS}> — built here so its height can spring.
    itemsCard: {
        overflow: 'hidden',
        backgroundColor: t.colors.surface,
        borderRadius: GROUP_RADIUS,
        borderWidth: 1,
        borderColor: t.colors.hairline,
    },
    inset: { paddingHorizontal: space.lg },
    itemsHead: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingTop: space.lg,
        paddingBottom: space.xs,
    },
    addMore: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: HIT + space.lg,
        paddingVertical: space.sm,
    },
    addMoreIcon: {
        width: ICON_CIRCLE,
        height: ICON_CIRCLE,
        borderRadius: radii.well,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addMoreTexts: { flex: 1 },
    clear: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        minHeight: HIT,
        paddingVertical: space.xs,
    },
    policy: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.xs },
    barDock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: z.sticky },
    sheetActions: { flexDirection: 'row', gap: space.md },
    flex: { flex: 1 },
}));

export default CheckoutScreen;
