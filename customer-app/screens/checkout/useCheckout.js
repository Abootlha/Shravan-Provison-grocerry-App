/**
 * All checkout state and the order/payment flow. The UI in CheckoutScreen and
 * screens/checkout/* only renders what this hook returns.
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
import { clearCart } from '../../store/slices/cartSlice';
import { useTranslation } from '../../hooks/useTranslation';
import { toast, haptic } from '../../components/ui';
import { computeBill } from './bill';
import { findPaymentOption } from './paymentMethods';
import { resolveCoords, toClientAddresses } from '../address/addressUtils';

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

export function useCheckout({ navigation, route }) {
    const dispatch = useDispatch();
    const { isHi } = useTranslation();

    const { totalAmount, totalItems, items: cartItems } = useSelector((state) => state.cart);
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
    const bill = useMemo(() => computeBill(hasItems ? totalAmount : 0), [hasItems, totalAmount]);
    const paymentOption = findPaymentOption(selectedPayment, isHi);

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
            if (profile?.addresses && profile.addresses.length > 0) {
                const formattedAddresses = toClientAddresses(profile.addresses);
                dispatch(setSavedAddresses(formattedAddresses));

                if (!selectedAddress) {
                    const defaultAddr = formattedAddresses.find((a) => a.isDefault) || formattedAddresses[0];
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
            itemTotal: bill.itemTotal,
            deliveryFee: bill.deliveryFee,
            packagingFee: bill.packagingFee,
            discount: bill.discount,
            totalAmount: bill.grandTotal,
            deliveryAddress: {
                type: addrToUse.type || 'Home',
                address: addrToUse.address || addrToUse.addressLine,
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

    const dismissFailure = () => {
        setIsProcessingPayment(false);
        setPaymentStep(PAYMENT_STEP.CONNECTING);
    };

    /**
     * Starts the order. Returns false when it could not start (validation),
     * so the slide-to-pay control can spring back.
     */
    const handleInitiatePayment = async () => {
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
            setIsProcessingPayment(true);
            setPaymentStep(PAYMENT_STEP.CONNECTING);

            // Step 1 after 1.2 seconds: preparing the order
            const t1 = setTimeout(() => {
                setPaymentStep(PAYMENT_STEP.VERIFYING);
            }, 1200);

            // Step 2 after 2.5 seconds: confirmed -> place the order
            const t2 = setTimeout(() => {
                setPaymentStep(PAYMENT_STEP.APPROVED);
                const t3 = setTimeout(async () => {
                    await placeCodOrder();
                }, 900);
                paymentTimersRef.current.push(t3);
            }, 2500);

            paymentTimersRef.current.push(t1, t2);
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
            console.error('Payment initiation failed:', error?.response?.status, error?.response?.data?.message || error.message);
            setIsProcessingPayment(false);
            toast.error(isHi ? 'भुगतान त्रुटि' : 'Payment error', {
                description: error?.response?.data?.message || (isHi ? 'पेमेंट गेटवे शुरू नहीं हो सका।' : 'Failed to initialize payment gateway.'),
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

    const placeCodOrder = async () => {
        setIsPlacing(true);
        try {
            const { orderId } = await createOrder(buildOrderData());
            dispatch(clearCart());
            setIsProcessingPayment(false);
            navigation.replace('OrderTracking', { orderId });
        } catch (error) {
            console.error('Order creation API error details:', error?.response?.status, error?.response?.data?.message || error.message);
            setIsProcessingPayment(false);
            setPaymentStep(PAYMENT_STEP.CONNECTING);
            toast.error(isHi ? 'ऑर्डर विफल' : 'Order failed', {
                description: error?.response?.data?.message || (isHi ? 'ऑर्डर नहीं दिया जा सका। कृपया फिर से प्रयास करें।' : 'Your order could not be placed. Please try again.'),
            });
        } finally {
            setIsPlacing(false);
        }
    };

    const clearCartItems = () => dispatch(clearCart());

    return {
        isHi,
        cartItems: cartItems || [],
        hasItems,
        totalItems,
        bill,
        tip,
        setTip,
        savedAddresses: savedAddresses || [],
        selectedAddress,
        selectAddress,
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
