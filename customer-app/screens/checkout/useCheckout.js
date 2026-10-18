/**
 * All checkout state and the order/payment flow. The UI in CheckoutScreen and
 * screens/checkout/* only renders what this hook returns.
 *
 * Bill: settings.fees give an instant estimate; POST /orders/quote (useOrderQuote) is the
 * bill the customer pays. Payment is blocked until a fresh quote for this exact cart exists.
 *
 * COD: POST /orders, then "Order placed" only once the server has created it, then the
 * tracking screen (GET /orders/:id + socket updates) shows the real status.
 *
 * Online payment (unchanged, see services/paymentService.js):
 *   createOrder (server sets paymentStatus PENDING) -> POST /payments/seamless-hash
 *   -> PayU (web: auto-submitted form, native: WebView) -> poll GET /orders/:id
 *   until paymentStatus is COMPLETED / FAILED, or ~60s ("still verifying").
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Linking } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { UserService } from '../../services';
import {
    PAYMENT_METHOD_MAP,
    PAYMENT_RESULT,
    getPayUOptions,
    createOrder,
    requestPaymentHash,
    submitPayUFormOnWeb,
    getNativePaymentRequest,
    parsePaymentReturnUrl,
    pollOrderPayment,
    checkOrderPayment,
} from '../../services/paymentService';
import { setSavedAddresses, setSelectedAddress } from '../../store/slices/locationSlice';
import { clearCart, removeFromCart } from '../../store/slices/cartSlice';
import { useTranslation } from '../../hooks/useTranslation';
import { toast, haptic } from '../../components/ui';
import { billFromQuote, estimateBill } from './bill';
import { useOrderQuote } from './useOrderQuote';
import { findPaymentOption } from './paymentMethods';
import { isSameAddress, orderAddressLine, resolveCoords, toClientAddresses } from '../address/addressUtils';
import { useServiceArea } from '../address/useServiceArea';
import { markStoreClosed, useStoreFees, useStoreStatus } from '../../hooks/useStoreSettings';
import { describeError, friendlyError } from '../../services/normalize';

/** POST /orders answers 409 { code: 'STORE_CLOSED', nextOpenAt } outside opening hours. */
const storeClosedError = (error) => {
    const data = error?.response?.data;
    if (error?.response?.status !== 409) return null;
    const code = data?.code || data?.error?.code;
    return code === 'STORE_CLOSED' ? { nextOpenAt: data?.nextOpenAt ?? data?.error?.nextOpenAt ?? null } : null;
};

/** Overlay steps. 0-3 are the existing flow; 4 is the failure screen. */
export const PAYMENT_STEP = {
    CONNECTING: 0,
    VERIFYING: 1,
    APPROVED: 2,
    STILL_VERIFYING: 3,
    FAILED: 4,
};

export const getInstructionOptions = (isHi) => [
    { id: 'call', label: isHi ? 'पहुंचने पर कॉल करें' : 'Call on arrival', en: 'Call on arrival', icon: 'phone-outline' },
    { id: 'door', label: isHi ? 'दरवाजे पर छोड़ दें' : 'Leave at door', en: 'Leave at door', icon: 'door' },
    { id: 'nobell', label: isHi ? 'घंटी न बजाएं' : "Don't ring the bell", en: "Don't ring the bell", icon: 'bell-off-outline' },
    { id: 'gate', label: isHi ? 'सिक्योरिटी गेट पर दें' : 'Leave with security', en: 'Leave with security', icon: 'shield-home-outline' },
];

const mongoIdPattern = /^[a-f\d]{24}$/i;

// A 4xx message the server wrote for people (e.g. "Item out of stock"); never 5xx internals.
const serverMessage = (error) => {
    const status = error?.response?.status;
    const msg = error?.response?.data?.message;
    return status && status < 500 && typeof msg === 'string' ? msg : null;
};

export function useCheckout({ navigation, route }) {
    const dispatch = useDispatch();
    const { isHi } = useTranslation();
    const store = useStoreStatus();
    const serviceArea = useServiceArea();

    const { totalItems, items: cartItems } = useSelector((state) => state.cart);
    const fees = useStoreFees();
    const { savedAddresses, selectedAddress } = useSelector((state) => state.location);

    const [selectedPayment, setSelectedPayment] = useState('phonepe');
    const [selectedInstructions, setSelectedInstructions] = useState(['call']);
    const [customInstruction, setCustomInstruction] = useState('');
    const [tip, setTip] = useState(0);
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(false);
    const [isPlacing, setIsPlacing] = useState(false);
    // Native PayU checkout request ({ url, body }) loaded in a WebView
    const [payuRequest, setPayuRequest] = useState(null);

    // Payment overlay
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [paymentStep, setPaymentStep] = useState(PAYMENT_STEP.CONNECTING);
    const paymentTimersRef = useRef([]);
    const pendingOrderIdRef = useRef(null);
    const pollingRef = useRef(false);
    const isMountedRef = useRef(true);

    const hasItems = !!cartItems && cartItems.length > 0;
    const quote = useOrderQuote(cartItems, { enabled: hasItems });
    // Lines the server will sell (refused ones are listed separately and block payment).
    const payableItems = useMemo(() => {
        if (!hasItems) return [];
        const bad = new Set(quote.refused.map((r) => r.id));
        return bad.size ? cartItems.filter((i) => !bad.has(i.id)) : cartItems;
    }, [hasItems, cartItems, quote.refused]);
    const bill = useMemo(() => {
        if (quote.quote) return billFromQuote(quote.quote, payableItems, fees);
        const itemTotal = payableItems.reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
        return estimateBill(itemTotal, payableItems, fees);
    }, [quote.quote, payableItems, fees]);
    // 'ready' | 'updating' | 'error' | 'refused'
    const billState = quote.refused.length
        ? 'refused'
        : quote.status === 'ready' && quote.quote
          ? 'ready'
          : quote.status === 'error'
            ? 'error'
            : 'updating';
    // The amount on the slide-to-pay: the quote's totalAmount, or null (never a guess).
    const payableAmount = billState === 'ready' ? Number(quote.quote.totalAmount) : null;
    const paymentOption = findPaymentOption(selectedPayment, isHi);

    // Where the order goes: distance from the store and whether it is inside the delivery radius.
    const addressInfo = useMemo(() => {
        const coords = resolveCoords(selectedAddress, savedAddresses || []);
        const distanceKm = coords ? serviceArea.distanceKm(coords) : null;
        const outOfArea = distanceKm != null && distanceKm > serviceArea.radiusKm;
        // A saved address (server id or index) is edited in place; a one-off pin is saved as new.
        const isSaved = !!selectedAddress && (
            mongoIdPattern.test(String(selectedAddress.id || '')) || Number.isInteger(selectedAddress.originalIndex)
        );
        return { coords, distanceKm, outOfArea, isSaved, radiusKm: serviceArea.radiusKm, store: serviceArea.store };
    }, [selectedAddress, savedAddresses, serviceArea.distanceKm, serviceArea.radiusKm, serviceArea.store]);
    const addressBlock = addressInfo.outOfArea
        ? (isHi ? 'यह पता डिलीवरी क्षेत्र से बाहर है' : 'Address is outside our delivery area')
        : null;

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            paymentTimersRef.current.forEach((t) => clearTimeout(t));
        };
    }, []);

    // Return from PayU (web redirect via PAYMENT_RETURN_URL, forwarded as route
    // params). ?payment=success is NOT proof of payment: always verify with the server.
    useEffect(() => {
        const payment = route?.params?.payment;
        if (!payment) return;
        const returnedOrderId = route?.params?.orderId || pendingOrderIdRef.current;
        navigation.setParams({ payment: undefined, orderId: undefined });

        // 'failed' can also mean PayU 'pending', so poll whenever we know the order.
        if (returnedOrderId) {
            verifyPayment(returnedOrderId);
        } else {
            // No orderId (e.g. the callback hash was rejected): nothing to verify.
            showPaymentFailed();
        }
    }, [route?.params?.payment]);

    const clearPaymentTimers = () => {
        paymentTimersRef.current.forEach((t) => clearTimeout(t));
        paymentTimersRef.current = [];
    };

    // Saved addresses
    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        setIsFetchingAddresses(true);
        try {
            const profile = await UserService.getProfile();
            if (Array.isArray(profile?.addresses)) {
                const formattedAddresses = toClientAddresses(profile.addresses);
                dispatch(setSavedAddresses(formattedAddresses));

                // Keep the current choice, refreshed to the saved copy (server id, new details).
                // A saved address that no longer exists (deleted elsewhere) is replaced by the
                // default; a one-off map pin stays selected.
                const current = selectedAddress
                    && (formattedAddresses.find((a) => a.id === selectedAddress.id)
                        || formattedAddresses.find((a) => isSameAddress(a, selectedAddress)));
                const wasSaved = !!selectedAddress && (
                    mongoIdPattern.test(String(selectedAddress.id || '')) || Number.isInteger(selectedAddress.originalIndex)
                );
                if (current) {
                    dispatch(setSelectedAddress(current));
                } else if (!selectedAddress || wasSaved) {
                    const defaultAddr = formattedAddresses.find((a) => a.isDefault) || formattedAddresses[0] || null;
                    dispatch(setSelectedAddress(defaultAddr));
                }
            }
        } catch (error) {
            // Not signed in / offline: the address row asks the user to add one.
        } finally {
            setIsFetchingAddresses(false);
        }
    };

    const selectAddress = (address) => dispatch(setSelectedAddress(address));

    const toggleInstruction = (id) => {
        setSelectedInstructions((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    };

    const buildInstructions = () => {
        const labels = getInstructionOptions(false)
            .filter((o) => selectedInstructions.includes(o.id))
            .map((o) => o.en);
        if (customInstruction.trim()) labels.push(customInstruction.trim());
        if (tip > 0) labels.push(`Tip ₹${tip} for the delivery partner (paid at the door)`);
        // POST /orders has no receiver fields: the rider reads them here.
        const receiver = [selectedAddress?.receiverName, selectedAddress?.receiverPhone].filter(Boolean).join(', ');
        if (receiver) labels.push(`Receiver: ${receiver}`);
        return labels.join(', ');
    };

    const buildOrderData = () => {
        const addrToUse = selectedAddress;
        const coords = resolveCoords(addrToUse, savedAddresses);
        const instructions = buildInstructions();
        return {
            items: cartItems.map((item) => ({
                productId: item.productId || item._id || item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                image: item.image || undefined,
            })),
            // Informational: the server prices the order itself, with the same calculation as the quote.
            itemTotal: quote.quote.itemTotal,
            deliveryFee: quote.quote.deliveryFee,
            packagingFee: quote.quote.packagingFee,
            discount: quote.quote.discount,
            totalAmount: quote.quote.totalAmount,
            deliveryAddress: {
                type: addrToUse.type || 'Home',
                // Flat / floor / landmark folded in: the order address has no fields for them.
                address: orderAddressLine(addrToUse),
                city: addrToUse.city,
                pincode: addrToUse.pincode,
                latitude: coords?.latitude,
                longitude: coords?.longitude,
            },
            // paymentStatus is owned by the server (new orders start PENDING).
            paymentMethod: PAYMENT_METHOD_MAP[selectedPayment] || 'UPI',
            ...(instructions ? { deliveryInstructions: instructions } : {}),
        };
    };

    const showPaymentFailed = () => {
        pendingOrderIdRef.current = null;
        clearPaymentTimers();
        setIsProcessingPayment(true);
        setPaymentStep(PAYMENT_STEP.FAILED);
        haptic.error();
    };

    const finishPaidOrder = (orderId) => {
        pendingOrderIdRef.current = null;
        dispatch(clearCart());
        setPaymentStep(PAYMENT_STEP.APPROVED);
        const t = setTimeout(() => {
            setIsProcessingPayment(false);
            navigation.replace('OrderTracking', { orderId });
        }, 1400);
        paymentTimersRef.current.push(t);
    };

    // Polls the order until the server has verified the payment (or ~60s pass).
    const verifyPayment = async (orderId) => {
        if (!orderId || pollingRef.current) return;
        pollingRef.current = true;
        pendingOrderIdRef.current = orderId;
        setIsProcessingPayment(true);
        setPaymentStep(PAYMENT_STEP.VERIFYING);

        const result = await pollOrderPayment(orderId, {
            timeoutMs: 60000,
            intervalMs: 3000,
            shouldStop: () => !isMountedRef.current || !pollingRef.current,
        });
        pollingRef.current = false;
        if (!isMountedRef.current || result === PAYMENT_RESULT.CANCELLED) return;

        if (result === PAYMENT_RESULT.COMPLETED) {
            finishPaidOrder(orderId);
        } else if (result === PAYMENT_RESULT.FAILED) {
            showPaymentFailed();
        } else {
            setPaymentStep(PAYMENT_STEP.STILL_VERIFYING);
        }
    };

    const checkAgain = () => verifyPayment(pendingOrderIdRef.current);

    const closeVerification = () => {
        pollingRef.current = false;
        setIsProcessingPayment(false);
        setPaymentStep(PAYMENT_STEP.CONNECTING);
        toast.info(isHi ? 'भुगतान सत्यापन जारी है' : 'Still verifying your payment', {
            description: isHi
                ? 'पुष्टि होने पर ऑर्डर मेरे ऑर्डर में दिखेगा। दोबारा भुगतान न करें।'
                : 'Once confirmed, the order will appear in My Orders. Please do not pay again.',
            duration: 6000,
        });
    };

    // 409 STORE_CLOSED: flip the app to "closed" everywhere and say when it opens. Returns true when handled.
    const handleStoreClosed = (error) => {
        const closed = storeClosedError(error);
        if (!closed) return false;
        markStoreClosed(closed.nextOpenAt);
        haptic.warning();
        toast.info(isHi ? 'स्टोर अभी बंद है' : 'The store is closed', {
            description: isHi ? 'आपका ऑर्डर नहीं दिया गया। खुलने पर फिर से कोशिश करें।' : 'Your order wasn’t placed. Try again when it opens.',
            duration: 6000,
        });
        return true;
    };

    const dismissFailure = () => {
        setIsProcessingPayment(false);
        setPaymentStep(PAYMENT_STEP.CONNECTING);
    };

    /**
     * Starts the order. Returns false when it could not start (validation),
     * so the slide-to-pay control can spring back.
     */
    const handleInitiatePayment = async () => {
        if (!store.isOpen) {
            toast.info(isHi ? 'स्टोर अभी बंद है' : 'The store is closed', { description: store.closedLine(isHi) });
            return false;
        }

        if (!cartItems || cartItems.length === 0) {
            toast.error(isHi ? 'कार्ट खाली है' : 'Your cart is empty', {
                description: isHi ? 'ऑर्डर करने से पहले कार्ट में आइटम जोड़ें।' : 'Add items to your cart before placing an order.',
            });
            return false;
        }

        if (!selectedAddress) {
            toast.error(isHi ? 'पता चुनें' : 'Select an address', {
                description: isHi ? 'कृपया डिलीवरी पता जोड़ें या चुनें।' : 'Please add or select a delivery address.',
            });
            return false;
        }

        if (!resolveCoords(selectedAddress, savedAddresses)) {
            toast.error(isHi ? 'पते का स्थान चाहिए' : 'Pin this address on the map', {
                description: isHi
                    ? 'डिलीवरी के लिए नक्शे पर स्थान चुनें।'
                    : 'We need its map location to deliver. Edit the address or pick another one.',
            });
            return false;
        }

        if (addressInfo.outOfArea) {
            toast.error(isHi ? 'यहाँ डिलीवरी उपलब्ध नहीं' : 'We don’t deliver to this address', {
                description: isHi
                    ? `यह पता स्टोर से ${addressInfo.distanceKm} किमी दूर है। ${addressInfo.radiusKm} किमी के भीतर का पता चुनें।`
                    : `It is ${addressInfo.distanceKm} km from the store. Choose an address within ${addressInfo.radiusKm} km.`,
            });
            return false;
        }

        if (billState !== 'ready') {
            if (billState === 'refused') {
                toast.error(isHi ? 'कुछ सामान उपलब्ध नहीं हैं' : 'Some items aren’t available', {
                    description: isHi ? 'ऑर्डर करने से पहले उन्हें हटाएं।' : 'Remove them from your cart before placing the order.',
                });
            } else if (billState === 'error') {
                toast.error(isHi ? 'कुल राशि की पुष्टि नहीं हुई' : 'Couldn’t confirm your total', {
                    description: isHi ? 'फिर से प्रयास करें।' : 'Tap Retry on the bill and try again.',
                });
            } else {
                toast.info(isHi ? 'कुल राशि अपडेट हो रही है' : 'Updating your total', {
                    description: isHi ? 'एक पल रुकें।' : 'One moment, then slide again.',
                });
            }
            return false;
        }

        const invalidCartItem = cartItems.find((item) => {
            const productId = item.productId || item._id || item.id;
            return !productId || !mongoIdPattern.test(String(productId));
        });

        if (invalidCartItem) {
            toast.error(isHi ? 'कार्ट रीफ्रेश की आवश्यकता है' : 'Cart needs refresh', {
                description: isHi ? 'कृपया इस आइटम को हटाकर फिर से जोड़ें।' : 'Please remove and add this item again before placing your order.',
            });
            return false;
        }

        clearPaymentTimers();

        if (selectedPayment === 'cod') {
            placeCodOrder();
            return true;
        }

        // Online payment: order (PENDING) -> server-signed PayU params -> PayU -> poll order.
        setIsPlacing(true);
        setIsProcessingPayment(true);
        setPaymentStep(PAYMENT_STEP.CONNECTING);
        try {
            const { orderId } = await createOrder(buildOrderData());
            pendingOrderIdRef.current = orderId;

            const payuOptions = getPayUOptions(selectedPayment);
            const hashData = await requestPaymentHash({ orderId, ...payuOptions });

            if (Platform.OS === 'web') {
                // The browser leaves the app; the backend redirects back to
                // PAYMENT_RETURN_URL?payment=...&orderId=... and we poll from there.
                submitPayUFormOnWeb(hashData);
                return true;
            }

            const request = await getNativePaymentRequest(hashData, payuOptions);
            setIsProcessingPayment(false);
            setPayuRequest(request);
        } catch (error) {
            if (__DEV__) console.error('[checkout] payment start failed', describeError(error), error?.response?.data);
            setIsProcessingPayment(false);
            if (handleStoreClosed(error)) return false;
            if (error?.response?.status === 400) quote.retry(); // re-check which lines the server refuses
            toast.error(isHi ? 'भुगतान त्रुटि' : 'Payment error', {
                description: serverMessage(error) || (error?.response ? (isHi ? 'पेमेंट गेटवे शुरू नहीं हो सका।' : 'Couldn’t start the payment. Try again.') : friendlyError(error, isHi)),
            });
        } finally {
            setIsPlacing(false);
        }
        return true;
    };

    const retryPayment = () => {
        dismissFailure();
        handleInitiatePayment();
    };

    const switchToCod = () => {
        setSelectedPayment('cod');
        dismissFailure();
    };

    // PayU finished (redirected to the backend return URL) -> verify with the server.
    const handlePayuReturn = (url) => {
        const parsed = parsePaymentReturnUrl(url);
        if (!parsed) return false;
        setPayuRequest(null);
        verifyPayment(parsed.orderId || pendingOrderIdRef.current);
        return true;
    };

    // User closed the PayU page: check once in case the payment already went through.
    const handlePayuClosed = async () => {
        setPayuRequest(null);
        const orderId = pendingOrderIdRef.current;
        if (!orderId) return;
        const result = await checkOrderPayment(orderId);
        if (result === PAYMENT_RESULT.COMPLETED) {
            setIsProcessingPayment(true);
            finishPaidOrder(orderId);
            return;
        }
        toast.info(isHi ? 'भुगतान रद्द किया गया' : 'Payment cancelled', {
            description: isHi ? 'भुगतान पूरा नहीं हुआ। आप फिर से प्रयास कर सकते हैं।' : 'The payment was not completed. You can try again.',
        });
    };

    // Opens UPI intent / app links that PayU's page hands to the WebView.
    const handlePayuNavigation = (request) => {
        const url = request?.url || '';
        if (handlePayuReturn(url)) return false;
        if (/^(https?|about|data|blob):/i.test(url)) return true;
        Linking.openURL(url).catch(() => {
            toast.error(isHi ? 'ऐप नहीं मिला' : 'App not found', {
                description: isHi ? 'यह भुगतान ऐप इस डिवाइस पर उपलब्ध नहीं है।' : 'The selected payment app is not available on this device.',
            });
        });
        return false;
    };

    const cancelPaymentProcess = () => {
        clearPaymentTimers();
        setIsProcessingPayment(false);
        setIsPlacing(false);
        setPaymentStep(PAYMENT_STEP.CONNECTING);
        toast.info(isHi ? 'भुगतान प्रक्रिया रद्द की गई' : 'Payment cancelled', {
            description: isHi ? 'आपका ऑर्डर नहीं दिया गया है।' : 'Your order was not placed.',
        });
    };

    // COD: one real request. "Placing your order…" (no cancel: the request can't be recalled)
    // until the server answers; "Order placed" only once it has created the order.
    const placeCodOrder = async () => {
        setIsPlacing(true);
        setIsProcessingPayment(true);
        setPaymentStep(PAYMENT_STEP.VERIFYING);
        try {
            const { orderId } = await createOrder(buildOrderData());
            finishPaidOrder(orderId);
        } catch (error) {
            if (__DEV__) console.error('[checkout] create order failed', describeError(error), error?.response?.data);
            setIsProcessingPayment(false);
            setPaymentStep(PAYMENT_STEP.CONNECTING);
            if (handleStoreClosed(error)) return;
            if (error?.response?.status === 400) quote.retry(); // re-check which lines the server refuses
            toast.error(isHi ? 'ऑर्डर विफल' : 'Order failed', {
                description: serverMessage(error) || (error?.response ? (isHi ? 'ऑर्डर नहीं दिया जा सका। कृपया फिर से प्रयास करें।' : 'Your order could not be placed. Please try again.') : friendlyError(error, isHi)),
            });
        } finally {
            setIsPlacing(false);
        }
    };

    const clearCartItems = () => dispatch(clearCart());

    // Removes the lines the server refused; the screen has listed them by name first.
    const removeRefusedItems = () => {
        quote.refused.forEach((r) => dispatch(removeFromCart(r.id)));
        haptic.light();
    };

    return {
        isHi,
        store,
        cartItems: cartItems || [],
        hasItems,
        totalItems,
        bill,
        billState,
        payableAmount,
        refusedItems: quote.refused,
        retryQuote: quote.retry,
        removeRefusedItems,
        tip,
        setTip,
        savedAddresses: savedAddresses || [],
        selectedAddress,
        selectAddress,
        addressInfo,
        addressBlock,
        isFetchingAddresses,
        selectedPayment,
        setSelectedPayment,
        paymentOption,
        selectedInstructions,
        toggleInstruction,
        customInstruction,
        setCustomInstruction,
        isPlacing,
        isProcessingPayment,
        paymentStep,
        payuRequest,
        handleInitiatePayment,
        cancelPaymentProcess,
        checkAgain,
        closeVerification,
        retryPayment,
        switchToCod,
        dismissFailure,
        handlePayuReturn,
        handlePayuClosed,
        handlePayuNavigation,
        clearCartItems,
    };
}
