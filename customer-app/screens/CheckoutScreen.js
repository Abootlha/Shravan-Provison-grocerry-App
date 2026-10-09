import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Alert,
    Image,
    TextInput,
    Platform,
    Modal,
    Linking,
} from 'react-native';
import {
    ArrowLeft02Icon,
    ShoppingCart01Icon,
    Location01Icon,
    FlashIcon,
    Add01Icon,
    MinusSignIcon,
    Clock01Icon,
    Call02Icon,
    Door01Icon,
    NotificationOff01Icon,
    Building01Icon,
    Ticket01Icon,
    CheckmarkCircle01Icon,
    SmartPhone01Icon,
    CreditCardIcon,
    BankIcon,
    Wallet01Icon,
    Cash01Icon,
    CustomerService01Icon,
    Leaf01Icon,
    ArrowRight01Icon,
    CheckmarkBadge01Icon,
    ArrowUp01Icon,
    ArrowDown01Icon,
    Home01Icon,
    Delete02Icon,
    LockIcon,
} from 'hugeicons-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, SHADOWS } from '../constants';
import { UserService } from '../services';
import { WebView } from 'react-native-webview';
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
} from '../services/paymentService';
import { setSavedAddresses, setSelectedAddress } from '../store/slices/locationSlice';
import { clearCart, incrementQuantity, decrementQuantity, removeFromCart } from '../store/slices/cartSlice';
import { useTranslation } from '../hooks/useTranslation';

const CheckoutScreen = ({ navigation, route }) => {
    const dispatch = useDispatch();
    const { currentLanguage } = useTranslation();
    const isHi = currentLanguage === 'hi';

    const { totalAmount, totalItems, items: cartItems } = useSelector((state) => state.cart);
    const { savedAddresses, selectedAddress } = useSelector((state) => state.location);

    // Dynamic State
    const [selectedPayment, setSelectedPayment] = useState('phonepe');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [deliveryPref, setDeliveryPref] = useState('express'); // 'express' | 'scheduled'
    const [selectedInstructions, setSelectedInstructions] = useState(['call']);
    const [customInstruction, setCustomInstruction] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [isFetchingAddresses, setIsFetchingAddresses] = useState(false);
    const [isPlacing, setIsPlacing] = useState(false);
    // Native PayU checkout request ({ url, body }) loaded in a WebView
    const [payuRequest, setPayuRequest] = useState(null);


    // Payment Gateway Processing State
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    // 0: Connecting, 1: Verifying with server, 2: Approved, 3: Still verifying (timed out)
    const [paymentStep, setPaymentStep] = useState(0);
    const paymentTimersRef = useRef([]);
    const pendingOrderIdRef = useRef(null);
    const pollingRef = useRef(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            paymentTimersRef.current.forEach(t => clearTimeout(t));
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
        paymentTimersRef.current.forEach(t => clearTimeout(t));
        paymentTimersRef.current = [];
    };

    // Payment display helper
    const getPaymentDisplayName = (id) => {
        switch (id) {
            case 'phonepe': return 'PhonePe UPI';
            case 'paytm': return 'Paytm UPI';
            case 'gpay': return 'Google Pay UPI';
            case 'amazon_upi': return 'Amazon Pay UPI';
            case 'super_upi': return 'Supermoney UPI';
            case 'add_upi': return 'Custom UPI ID';
            case 'card': return 'Credit / Debit Card';
            case 'pluxee': return 'Pluxee / Sodexo';
            case 'wallet_sk': return 'Shravan Kirana Money';
            case 'amazon_wallet': return 'Amazon Pay Balance';
            case 'mobikwik': return 'Mobikwik Wallet';
            case 'netbanking': return 'Netbanking';
            case 'cod': return isHi ? 'कैश ऑन डिलीवरी' : 'Cash on Delivery';
            default: return 'PhonePe UPI';
        }
    };

    // Dummy fallback cart items if cart is empty for preview
    const activeCartItems = cartItems && cartItems.length > 0 ? cartItems : [
        {
            id: 'demo-1',
            productId: '64b1f2e1a3c4b5c6d7e8f9a0',
            name: isHi ? 'अमूल ताज़ा टोंड दूध' : 'Amul Taaza Toned Fresh Milk',
            variant: '1 L',
            price: 54,
            quantity: 2,
            image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=200&q=80',
        },
        {
            id: 'demo-2',
            productId: '64b1f2e1a3c4b5c6d7e8f9a1',
            name: isHi ? 'फॉर्च्यून सनफ्लावर तेल' : 'Fortune Sunlite Sunflower Oil',
            variant: '1 L Pouch',
            price: 135,
            quantity: 1,
            image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=200&q=80',
        },
        {
            id: 'demo-3',
            productId: '64b1f2e1a3c4b5c6d7e8f9a2',
            name: isHi ? 'ताज़े बासमती चावल' : 'India Gate Basmati Rice Super',
            variant: '1 kg',
            price: 180,
            quantity: 1,
            image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=200&q=80',
        },
    ];

    const effectiveTotalAmount = cartItems && cartItems.length > 0
        ? totalAmount
        : activeCartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const effectiveTotalItems = cartItems && cartItems.length > 0
        ? totalItems
        : activeCartItems.reduce((acc, item) => acc + item.quantity, 0);

    // Bill Calculations
    const deliveryFee = effectiveTotalAmount >= 199 ? 0 : 25;
    const packagingFee = 5;
    const platformFee = 3;
    const baseDiscount = Math.round(effectiveTotalAmount * 0.08);
    const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
    const totalDiscount = baseDiscount + couponDiscount;
    const grandTotal = Math.max(0, effectiveTotalAmount + deliveryFee + packagingFee + platformFee - totalDiscount);
    const totalSavings = totalDiscount + (deliveryFee === 0 ? 25 : 0);

    // Fetch addresses on mount
    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        setIsFetchingAddresses(true);
        try {
            const profile = await UserService.getProfile();
            if (profile?.addresses && profile.addresses.length > 0) {
                const formattedAddresses = profile.addresses.map((addr, index) => ({
                    id: `saved-${index}`,
                    type: addr.type || 'Home',
                    name: profile.name || 'Amit Kumar',
                    phone: profile.phone || '9899XXXXXX',
                    address: addr.address || 'Medical Road, Near University Gate',
                    city: addr.city || 'Gorakhpur',
                    pincode: addr.pincode || '273009',
                    isDefault: addr.isDefault,
                }));
                dispatch(setSavedAddresses(formattedAddresses));

                if (!selectedAddress) {
                    const defaultAddr = formattedAddresses.find(a => a.isDefault) || formattedAddresses[0];
                    dispatch(setSelectedAddress(defaultAddr));
                }
            }
        } catch (error) {
            // Silently use default mock address if unauthorized
        } finally {
            setIsFetchingAddresses(false);
        }
    };

    // Instruction chips toggle
    const toggleInstruction = (id) => {
        if (selectedInstructions.includes(id)) {
            setSelectedInstructions(selectedInstructions.filter(item => item !== id));
        } else {
            setSelectedInstructions([...selectedInstructions, id]);
        }
    };

    // Item Quantity Stepper
    const handleIncreaseQty = (item) => {
        dispatch(incrementQuantity(item.id));
    };

    const handleDecreaseQty = (item) => {
        dispatch(decrementQuantity(item.id));
    };

    // Place Order handler
    const mongoIdPattern = /^[a-f\d]{24}$/i;

    const buildOrderData = () => {
        const addrToUse = selectedAddress;
        return {
            items: cartItems.map(item => ({
                productId: item.productId || item._id || item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                image: item.image || undefined,
            })),
            itemTotal: effectiveTotalAmount,
            deliveryFee,
            packagingFee,
            platformFee,
            discount: totalDiscount,
            totalAmount: grandTotal,
            deliveryAddress: {
                type: addrToUse.type || 'Home',
                address: addrToUse.address || addrToUse.addressLine,
                city: addrToUse.city,
                pincode: addrToUse.pincode,
                latitude: addrToUse.latitude,
                longitude: addrToUse.longitude,
            },
            // paymentStatus is owned by the server (new orders start PENDING).
            paymentMethod: PAYMENT_METHOD_MAP[selectedPayment] || 'UPI',
            deliveryPreference: deliveryPref,
            instructions: selectedInstructions.join(', ') + (customInstruction ? ` (${customInstruction})` : ''),
        };
    };

    const showPaymentFailed = () => {
        Alert.alert(
            isHi ? 'भुगतान विफल' : 'Payment Failed',
            isHi
                ? 'आपका भुगतान पूरा नहीं हो सका। कृपया दूसरा भुगतान तरीका आज़माएं या फिर से प्रयास करें।'
                : 'Your transaction could not be processed. Please try another payment method or try again.'
        );
    };

    const finishPaidOrder = (orderId) => {
        pendingOrderIdRef.current = null;
        dispatch(clearCart());
        setPaymentStep(2);
        const t = setTimeout(() => {
            setIsProcessingPayment(false);
            navigation.replace('OrderTracking', { orderId });
        }, 900);
        paymentTimersRef.current.push(t);
    };

    // Polls the order until the server has verified the payment (or ~60s pass).
    const verifyPayment = async (orderId) => {
        if (!orderId || pollingRef.current) return;
        pollingRef.current = true;
        pendingOrderIdRef.current = orderId;
        setIsProcessingPayment(true);
        setPaymentStep(1);

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
            pendingOrderIdRef.current = null;
            setIsProcessingPayment(false);
            setPaymentStep(0);
            showPaymentFailed();
        } else {
            setPaymentStep(3);
        }
    };

    const closeVerification = () => {
        pollingRef.current = false;
        setIsProcessingPayment(false);
        setPaymentStep(0);
        Alert.alert(
            isHi ? 'भुगतान सत्यापन जारी है' : 'Still verifying payment',
            isHi
                ? 'हम आपके भुगतान की पुष्टि कर रहे हैं। पुष्टि होने पर ऑर्डर मेरे ऑर्डर में दिखेगा। दोबारा भुगतान न करें।'
                : 'We are still confirming your payment. Once confirmed, the order will appear in My Orders. Please do not pay again.'
        );
    };

    const handleInitiatePayment = async () => {
        if (!cartItems || cartItems.length === 0) {
            Alert.alert(
                isHi ? 'कार्ट खाली है' : 'Your cart is empty',
                isHi ? 'ऑर्डर करने से पहले कार्ट में आइटम जोड़ें।' : 'Add items to your cart before placing an order.'
            );
            return;
        }

        if (!selectedAddress) {
            Alert.alert(
                isHi ? 'पता चुनें' : 'Select an address',
                isHi ? 'कृपया डिलीवरी पता जोड़ें या चुनें।' : 'Please add or select a delivery address.'
            );
            return;
        }

        const invalidCartItem = cartItems.find((item) => {
            const productId = item.productId || item._id || item.id;
            return !productId || !mongoIdPattern.test(String(productId));
        });

        if (invalidCartItem) {
            Alert.alert(
                isHi ? 'कार्ट रीफ्रेश की आवश्यकता है' : 'Cart needs refresh',
                isHi ? 'कृपया इस आइटम को हटाकर फिर से जोड़ें।' : 'Please remove and add this item again before placing your order.'
            );
            return;
        }

        setIsPaymentModalOpen(false);
        clearPaymentTimers();

        if (selectedPayment === 'cod') {
            setIsProcessingPayment(true);
            setPaymentStep(0);

            // Step 1 after 1.2 seconds: Verifying transaction with gateway
            const t1 = setTimeout(() => {
                setPaymentStep(1);
            }, 1200);

            // Step 2 after 2.5 seconds: Payment Approved -> Trigger order placement
            const t2 = setTimeout(() => {
                setPaymentStep(2);
                const t3 = setTimeout(async () => {
                    await placeCodOrder();
                }, 900);
                paymentTimersRef.current.push(t3);
            }, 2500);

            paymentTimersRef.current.push(t1, t2);
            return;
        }

        // Online payment: order (PENDING) -> server-signed PayU params -> PayU -> poll order.
        setIsPlacing(true);
        setIsProcessingPayment(true);
        setPaymentStep(0);
        try {
            const { orderId } = await createOrder(buildOrderData());
            pendingOrderIdRef.current = orderId;

            const payuOptions = getPayUOptions(selectedPayment);
            const hashData = await requestPaymentHash({ orderId, ...payuOptions });

            if (Platform.OS === 'web') {
                // The browser leaves the app; the backend redirects back to
                // PAYMENT_RETURN_URL?payment=...&orderId=... and we poll from there.
                submitPayUFormOnWeb(hashData);
                return;
            }

            const request = await getNativePaymentRequest(hashData, payuOptions);
            setIsProcessingPayment(false);
            setPayuRequest(request);
        } catch (error) {
            console.error('Payment initiation failed:', error?.response?.status, error?.response?.data?.message || error.message);
            setIsProcessingPayment(false);
            Alert.alert(
                isHi ? 'भुगतान त्रुटि' : 'Payment Error',
                error?.response?.data?.message || (isHi ? 'पेमेंट गेटवे शुरू नहीं हो सका।' : 'Failed to initialize payment gateway.')
            );
        } finally {
            setIsPlacing(false);
        }
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
        Alert.alert(
            isHi ? 'भुगतान रद्द किया गया' : 'Payment Cancelled',
            isHi ? 'भुगतान पूरा नहीं हुआ। आप फिर से प्रयास कर सकते हैं।' : 'The payment was not completed. You can try again.'
        );
    };

    // Opens UPI intent / app links that PayU's page hands to the WebView.
    const handlePayuNavigation = (request) => {
        const url = request?.url || '';
        if (handlePayuReturn(url)) return false;
        if (/^(https?|about|data|blob):/i.test(url)) return true;
        Linking.openURL(url).catch(() => {
            Alert.alert(
                isHi ? 'ऐप नहीं मिला' : 'App not found',
                isHi ? 'यह भुगतान ऐप इस डिवाइस पर उपलब्ध नहीं है।' : 'The selected payment app is not available on this device.'
            );
        });
        return false;
    };

    const cancelPaymentProcess = () => {
        clearPaymentTimers();
        setIsProcessingPayment(false);
        setIsPlacing(false);
        setPaymentStep(0);
        Alert.alert(
            isHi ? 'भुगतान प्रक्रिया रद्द की गई' : 'Payment Cancelled',
            isHi ? 'भुगतान प्रक्रिया रद्द कर दी गई है। आपका ऑर्डर नहीं दिया गया है।' : 'Payment transaction was cancelled. Your order was not placed.'
        );
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
            setPaymentStep(0);
            Alert.alert(
                isHi ? 'ऑर्डर विफल' : 'Order Failed',
                error?.response?.data?.message || (isHi ? 'ऑर्डर नहीं दिया जा सका। कृपया फिर से प्रयास करें।' : 'Your order could not be placed. Please try again.')
            );
        } finally {
            setIsPlacing(false);
        }
    };

    const activeAddress = selectedAddress || {
        type: 'Home',
        name: 'Amit Kumar',
        address: 'Medical Road, Gorakhpur',
        phone: '+91 9899XXXXXX',
    };

    const coupons = [
        { code: 'SAVE100', title: isHi ? '₹100 की फ्लैट छूट' : 'Flat ₹100 Off', subtitle: isHi ? '₹399 से ऊपर के ऑर्डर पर' : 'On orders above ₹399', discount: 100 },
        { code: 'WELCOME20', title: isHi ? '20% की अतिरिक्त छूट' : '20% OFF', subtitle: isHi ? '₹150 तक की बचत' : 'Save up to ₹150', discount: 65 },
        { code: 'SHRAVAN50', title: isHi ? '₹50 का instant कैशबैक' : 'Flat ₹50 Instant Cashback', subtitle: isHi ? 'बिना न्यूनतम मूल्य' : 'No min order required', discount: 50 },
    ];

    const instructionChips = [
        { id: 'call', label: isHi ? 'पहुंचने पर कॉल करें' : 'Call on arrival', icon: Call02Icon },
        { id: 'door', label: isHi ? 'दरवाजे पर छोड़ दें' : 'Leave at door', icon: Door01Icon },
        { id: 'nobell', label: isHi ? 'घंटी न बजाएं' : 'Do not ring bell', icon: NotificationOff01Icon },
        { id: 'gate', label: isHi ? 'सिक्योरिटी गेट पर दें' : 'Security gate', icon: Building01Icon },
    ];

    const paymentMethods = [
        { id: 'upi', name: isHi ? 'यूपीआई (गूगल पे / फोनपे / पेटीएम)' : 'UPI (Google Pay / PhonePe / Paytm)', sub: isHi ? 'सुपरफास्ट & सुरक्षित भुगतान' : 'Instant & Seamless Payment', icon: SmartPhone01Icon, badge: 'Popular' },
        { id: 'cod', name: isHi ? 'कैश ऑन डिलीवरी (COD)' : 'Cash on Delivery', sub: isHi ? 'डिलीवरी के समय भुगतान करें' : 'Pay cash or UPI upon delivery', icon: Cash01Icon },
        { id: 'card', name: isHi ? 'क्रेडिट / डेबिट कार्ड' : 'Credit / Debit Card', sub: isHi ? 'सभी प्रमुख कार्ड स्वीकार्य' : 'Visa, Mastercard, RuPay', icon: CreditCardIcon },
        { id: 'wallet', name: isHi ? 'डिजिटल वॉलेट' : 'Wallets (Paytm / Mobikwik)', sub: isHi ? 'त्वरित वॉलेट भुगतान' : 'Fast checkout from balance', icon: Wallet01Icon },
        { id: 'netbanking', name: isHi ? 'नेट बैंकिंग' : 'Net Banking', sub: isHi ? 'सभी भारतीय बैंक' : 'All major Indian banks', icon: BankIcon },
    ];

    const handleClearCart = () => {
        Alert.alert(
            isHi ? 'कार्ट खाली करें?' : 'Clear Cart?',
            isHi ? 'क्या आप कार्ट से सभी सामान हटाना चाहते हैं?' : 'Are you sure you want to remove all items from your cart?',
            [
                { text: isHi ? 'रद्द करें' : 'Cancel', style: 'cancel' },
                {
                    text: isHi ? 'हाँ, हटाएँ' : 'Yes, Clear',
                    style: 'destructive',
                    onPress: () => {
                        dispatch(clearCart());
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

            {/* Sticky Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
                    <ArrowLeft02Icon size={22} color={COLORS.text} strokeWidth={2.2} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isHi ? 'चेकआउट' : 'Checkout'}</Text>
                <TouchableOpacity onPress={handleClearCart} style={styles.cartIconWrapper} activeOpacity={0.8}>
                    <Delete02Icon size={20} color="#EF4444" strokeWidth={2.2} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Delivery Address Card */}
                <View style={styles.card}>
                    <View style={styles.addressHeader}>
                        <View style={styles.addressTitleRow}>
                            <View style={styles.pinBadge}>
                                <Location01Icon size={18} color="#6C3CF4" strokeWidth={2.5} />
                                <CheckmarkBadge01Icon size={12} color="#10B981" style={styles.verifiedCheck} />
                            </View>
                            <View style={{ marginLeft: 10 }}>
                                <Text style={styles.deliveringToLabel}>{isHi ? 'डिलीवरी पता' : 'Delivering to'}</Text>
                                <Text style={styles.addressType}>{activeAddress.type || 'Home'}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.changeBtn}
                            onPress={() => navigation.navigate('Location')}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.changeBtnText}>{isHi ? 'बदलें' : 'Change'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.addressDetails}>
                        <Text style={styles.recipientName}>{activeAddress.name || 'Amit Kumar'}</Text>
                        <Text style={styles.fullAddress}>{activeAddress.address || 'Medical Road, Gorakhpur'}</Text>
                        <Text style={styles.phoneText}>{activeAddress.phone || '9899XXXXXX'}</Text>
                    </View>

                    {/* Small Delivery ETA Badge */}
                    <View style={styles.etaBadge}>
                        <FlashIcon size={16} color="#D97706" strokeWidth={2.5} />
                        <Text style={styles.etaBadgeText}>
                            {isHi ? '⚡ 10 मिनट में सुपरफास्ट डिलीवरी' : '⚡ Delivery in 10 minutes'}
                        </Text>
                    </View>
                </View>

                {/* Items Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardSectionTitle}>
                            {isHi ? `आपकी कार्ट (${effectiveTotalItems} सामान)` : `Your Cart (${effectiveTotalItems} items)`}
                        </Text>
                        <Text style={styles.tapToEditHint}>{isHi ? 'मात्रा बदलने के लिए टैप करें' : 'Tap to edit quantity'}</Text>
                    </View>

                    {activeCartItems.map((item, index) => (
                        <View key={item.id || index} style={styles.itemRow}>
                            <Image
                                source={{ uri: item.image || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80' }}
                                style={styles.itemImage}
                            />
                            <View style={styles.itemDetails}>
                                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.itemVariant}>{item.variant || '1 unit'}</Text>
                                <Text style={styles.itemPrice}>₹{item.price}</Text>
                            </View>

                            {/* Quantity Stepper */}
                            <View style={styles.stepperContainer}>
                                <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => handleDecreaseQty(item)}
                                    activeOpacity={0.8}
                                >
                                    <MinusSignIcon size={14} color="#6C3CF4" strokeWidth={2.5} />
                                </TouchableOpacity>
                                <Text style={styles.stepperQty}>{item.quantity}</Text>
                                <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => handleIncreaseQty(item)}
                                    activeOpacity={0.8}
                                >
                                    <Add01Icon size={14} color="#6C3CF4" strokeWidth={2.5} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity
                        style={styles.addMoreBtn}
                        onPress={() => navigation.navigate('Home')}
                        activeOpacity={0.85}
                    >
                        <Add01Icon size={18} color="#6C3CF4" strokeWidth={2.5} />
                        <Text style={styles.addMoreText}>{isHi ? '+ और सामान जोड़ें' : '+ Add more products'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Delivery Preference */}
                <View style={styles.card}>
                    <Text style={styles.cardSectionTitle}>{isHi ? 'डिलीवरी विकल्प' : 'Delivery Preference'}</Text>

                    <View style={styles.prefRow}>
                        <TouchableOpacity
                            style={[styles.prefCard, deliveryPref === 'express' && styles.prefCardActive]}
                            onPress={() => setDeliveryPref('express')}
                            activeOpacity={0.9}
                        >
                            <View style={styles.radioRow}>
                                <View style={[styles.radioCircle, deliveryPref === 'express' && styles.radioCircleActive]}>
                                    {deliveryPref === 'express' && <View style={styles.radioInner} />}
                                </View>
                                <Text style={[styles.prefTitle, deliveryPref === 'express' && styles.prefTitleActive]}>
                                    {isHi ? 'एक्सप्रेस' : 'Express Delivery'}
                                </Text>
                            </View>
                            <View style={styles.prefBadge}>
                                <FlashIcon size={14} color="#D97706" strokeWidth={2.5} />
                                <Text style={styles.prefBadgeText}>10 mins</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.prefCard, deliveryPref === 'scheduled' && styles.prefCardActive]}
                            onPress={() => setDeliveryPref('scheduled')}
                            activeOpacity={0.9}
                        >
                            <View style={styles.radioRow}>
                                <View style={[styles.radioCircle, deliveryPref === 'scheduled' && styles.radioCircleActive]}>
                                    {deliveryPref === 'scheduled' && <View style={styles.radioInner} />}
                                </View>
                                <Text style={[styles.prefTitle, deliveryPref === 'scheduled' && styles.prefTitleActive]}>
                                    {isHi ? 'निर्धारित' : 'Scheduled'}
                                </Text>
                            </View>
                            <Text style={styles.prefSubtext}>Today • Choose Time →</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Delivery Instructions */}
                <View style={styles.card}>
                    <Text style={styles.cardSectionTitle}>{isHi ? 'डिलीवरी पार्टनर के लिए निर्देश' : 'What should our delivery partner know?'}</Text>

                    <View style={styles.chipsRow}>
                        {instructionChips.map((chip) => {
                            const IconComponent = chip.icon;
                            const isSelected = selectedInstructions.includes(chip.id);
                            return (
                                <TouchableOpacity
                                    key={chip.id}
                                    style={[styles.instructionChip, isSelected && styles.instructionChipActive]}
                                    onPress={() => toggleInstruction(chip.id)}
                                    activeOpacity={0.85}
                                >
                                    <IconComponent size={16} color={isSelected ? '#6C3CF4' : COLORS.textSecondary} strokeWidth={2} />
                                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{chip.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <TextInput
                        style={styles.instructionInput}
                        placeholder={isHi ? 'अतिरिक्त निर्देश (उदा. लिफ्ट का उपयोग करें)...' : 'Additional instructions for delivery rider...'}
                        placeholderTextColor={COLORS.textLight}
                        value={customInstruction}
                        onChangeText={setCustomInstruction}
                        multiline
                    />
                </View>

                {/* Offers & Available Coupons */}
                <View style={styles.card}>
                    <View style={styles.couponHeaderRow}>
                        <Ticket01Icon size={20} color="#D97706" strokeWidth={2.2} />
                        <Text style={[styles.cardSectionTitle, { marginBottom: 0, marginLeft: 8 }]}>
                            {isHi ? 'उपलब्ध कूपन' : 'Available Coupons'}
                        </Text>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.couponScrollView}>
                        {coupons.map((coupon, idx) => {
                            const isApplied = appliedCoupon?.code === coupon.code;
                            return (
                                <View key={idx} style={[styles.couponCard, isApplied && styles.couponCardApplied]}>
                                    <View style={styles.couponCodeRow}>
                                        <Text style={styles.couponCodeText}>{coupon.code}</Text>
                                        <View style={styles.couponPill}>
                                            <Text style={styles.couponPillText}>{coupon.title}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.couponSubtitle}>{coupon.subtitle}</Text>
                                    <TouchableOpacity
                                        style={[styles.applyBtn, isApplied && styles.appliedBtn]}
                                        onPress={() => setAppliedCoupon(isApplied ? null : coupon)}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={[styles.applyBtnText, isApplied && styles.appliedBtnText]}>
                                            {isApplied ? (isHi ? 'लागू हुआ ✓' : 'Applied ✓') : (isHi ? 'लागू करें →' : 'Apply →')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Payment Summary */}
                <View style={styles.card}>
                    <Text style={styles.cardSectionTitle}>{isHi ? 'भुगतान विवरण' : 'Payment Summary'}</Text>

                    <View style={styles.billRow}>
                        <Text style={styles.billLabel}>{isHi ? 'सामान का कुल मूल्य' : 'Item Total'}</Text>
                        <Text style={styles.billValue}>₹{effectiveTotalAmount}</Text>
                    </View>

                    <View style={styles.billRow}>
                        <Text style={[styles.billLabel, { color: '#16A34A' }]}>{isHi ? 'उत्पाद छूट' : 'Product Discount'}</Text>
                        <Text style={[styles.billValue, { color: '#16A34A' }]}>-₹{baseDiscount}</Text>
                    </View>

                    {appliedCoupon && (
                        <View style={styles.billRow}>
                            <Text style={[styles.billLabel, { color: '#16A34A' }]}>
                                {isHi ? `कूपन छूट (${appliedCoupon.code})` : `Coupon Discount (${appliedCoupon.code})`}
                            </Text>
                            <Text style={[styles.billValue, { color: '#16A34A' }]}>-₹{couponDiscount}</Text>
                        </View>
                    )}

                    <View style={styles.billRow}>
                        <Text style={styles.billLabel}>{isHi ? 'डिलीवरी शुल्क' : 'Delivery Fee'}</Text>
                        <Text style={[styles.billValue, deliveryFee === 0 && styles.freeText]}>
                            {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                        </Text>
                    </View>

                    <View style={styles.billRow}>
                        <Text style={styles.billLabel}>{isHi ? 'पैकेजिंग शुल्क' : 'Platform & Handling Fee'}</Text>
                        <Text style={styles.billValue}>₹{packagingFee + platformFee}</Text>
                    </View>

                    <View style={styles.billDivider} />

                    <View style={styles.billRow}>
                        <Text style={styles.grandTotalLabel}>{isHi ? 'कुल राशि' : 'Grand Total'}</Text>
                        <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
                    </View>

                    {/* Savings Badge */}
                    <View style={styles.savingsBanner}>
                        <CheckmarkCircle01Icon size={18} color="#16A34A" strokeWidth={2.2} />
                        <Text style={styles.savingsBannerText}>
                            {isHi ? (
                                <>बधाई! आपने इस ऑर्डर पर <Text style={styles.savingsBold}>₹{totalSavings}</Text> बचाए!</>
                            ) : (
                                <>Yay! You saved <Text style={styles.savingsBold}>₹{totalSavings}</Text> on this order!</>
                            )}
                        </Text>
                    </View>
                </View>

                {/* Selected Payment Summary Trigger Card */}
                <TouchableOpacity
                    style={styles.paymentTriggerCard}
                    onPress={() => setIsPaymentModalOpen(true)}
                    activeOpacity={0.88}
                >
                    <View style={styles.paymentTriggerLeft}>
                        <View style={styles.paymentTriggerIconBox}>
                            <SmartPhone01Icon size={20} color="#475569" strokeWidth={2.2} />
                        </View>
                        <View>
                            <Text style={styles.paymentTriggerSub}>{isHi ? 'चयनित भुगतान विधि' : 'Selected Payment Method'}</Text>
                            <Text style={styles.paymentTriggerTitle}>{getPaymentDisplayName(selectedPayment)}</Text>
                        </View>
                    </View>
                    <View style={styles.changeMethodBtnPill}>
                        <Text style={styles.changeMethodText}>{isHi ? 'बदलें' : 'Change'}</Text>
                        <ArrowRight01Icon size={14} color="#475569" strokeWidth={2.5} />
                    </View>
                </TouchableOpacity>

                {/* Need Help Card */}
                <View style={styles.helpCard}>
                    <View style={styles.helpHeaderRow}>
                        <View style={styles.helpIconCircle}>
                            <CustomerService01Icon size={22} color="#D97706" strokeWidth={2.2} />
                        </View>
                        <View>
                            <Text style={styles.helpTitle}>{isHi ? 'क्या आपको सहायता चाहिए?' : 'Need assistance?'}</Text>
                            <Text style={styles.helpSub}>{isHi ? 'हमारी 24x7 सहायता टीम आपकी मदद के लिए तैयार है' : 'Our 24x7 support team is here to help'}</Text>
                        </View>
                    </View>
                    <View style={styles.helpActionsRow}>
                        <TouchableOpacity style={styles.helpBtn} activeOpacity={0.85}>
                            <Text style={styles.helpBtnText}>{isHi ? 'चैट करें' : 'Chat with us'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.helpBtn, styles.helpBtnOutline]} activeOpacity={0.85}>
                            <Text style={[styles.helpBtnText, styles.helpBtnOutlineText]}>{isHi ? 'कॉलिंग सपोर्ट' : 'Call Support'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Order Note */}
                <View style={styles.noteCard}>
                    <View style={styles.noteRow}>
                        <Leaf01Icon size={18} color="#10B981" strokeWidth={2.2} />
                        <Text style={styles.noteText}>{isHi ? 'पर्यावरण के अनुकूल इको-पैकिंग सक्षम है' : 'Eco-friendly packing enabled'}</Text>
                    </View>
                    <View style={styles.noteDivider} />
                    <View style={styles.noteRow}>
                        <Clock01Icon size={18} color="#6C3CF4" strokeWidth={2.2} />
                        <Text style={styles.noteText}>{isHi ? 'अनुमानित डिलीवरी समय: 10-15 मिनट' : 'Estimated delivery time: 10–15 mins'}</Text>
                    </View>
                </View>

                <View style={{ height: 250 }} />
            </ScrollView>

            {/* Bottom Sticky Bar (Image 1 reference) */}
            <View style={styles.bottomBarContainer}>
                {/* Delivery Address Header Pill */}
                <View style={styles.addressBarPill}>
                    <View style={styles.addressBarPillLeft}>
                        <View style={styles.homeIconSmall}>
                            <Home01Icon size={16} color="#D97706" strokeWidth={2.2} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.addressPillTitle} numberOfLines={1}>
                                {isHi ? 'डिलीवरी पता: ' : 'Delivering to '}<Text style={{ fontWeight: '800' }}>{selectedAddress?.title || 'Home'}</Text>
                            </Text>
                            <Text style={styles.addressPillSub} numberOfLines={1}>
                                {selectedAddress ? `${selectedAddress.addressLine}, ${selectedAddress.city}` : 'Mohaddipur Orion Mall, Gorakhpur'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('Location')} activeOpacity={0.7}>
                        <Text style={styles.changeTextPill}>{isHi ? 'बदलें' : 'Change'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Bottom Action Row (PAY USING ▲ + Place Order Pill) */}
                <View style={styles.bottomActionRow}>
                    {/* Left: PAY USING ▲ Trigger */}
                    <TouchableOpacity 
                        style={styles.payUsingTrigger}
                        onPress={() => setIsPaymentModalOpen(true)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.payUsingHeaderRow}>
                            <Text style={styles.payUsingText}>{isHi ? 'भुगतान विधि' : 'PAY USING'}</Text>
                            <ArrowUp01Icon size={12} color="#6C3CF4" strokeWidth={2.8} />
                        </View>
                        <Text style={styles.selectedPayName} numberOfLines={1}>
                            {getPaymentDisplayName(selectedPayment)}
                        </Text>
                    </TouchableOpacity>

                    {/* Right: Rounded Green/Purple Place Order Pill */}
                    <TouchableOpacity
                        style={[styles.placeOrderPillBtn, isPlacing && styles.placeOrderBtnDisabled]}
                        onPress={handleInitiatePayment}
                        disabled={isPlacing}
                        activeOpacity={0.9}
                    >
                        {isPlacing ? (
                            <ActivityIndicator size="small" color={COLORS.white} />
                        ) : (
                            <View style={styles.placeOrderBtnContent}>
                                <View style={styles.priceCol}>
                                    <Text style={styles.pillPriceText}>₹{grandTotal}</Text>
                                    <Text style={styles.pillTotalLabel}>TOTAL</Text>
                                </View>
                                <View style={styles.placeOrderActionRight}>
                                    <Text style={styles.pillActionText}>{isHi ? 'ऑर्डर दें' : 'Place Order'}</Text>
                                    <ArrowRight01Icon size={15} color={COLORS.white} strokeWidth={3} />
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Select Payment Method Bottom Sheet Modal (Image 2 & 3 reference) */}
            <Modal
                visible={isPaymentModalOpen}
                transparent
                animationType="slide"
                onRequestClose={() => setIsPaymentModalOpen(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsPaymentModalOpen(false)}
                >
                    <TouchableOpacity 
                        style={styles.bottomSheetContainer}
                        activeOpacity={1}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Drag indicator & Header */}
                        <View style={styles.sheetHeader}>
                            <View style={styles.dragHandleBar} />
                            <TouchableOpacity 
                                style={styles.sheetTitleRow} 
                                onPress={() => setIsPaymentModalOpen(false)}
                                activeOpacity={0.7}
                            >
                                <ArrowDown01Icon size={20} color="#1E293B" strokeWidth={2.5} />
                                <Text style={styles.sheetTitle}>{isHi ? 'भुगतान का तरीका चुनें' : 'Select Payment Method'}</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.sheetScrollContent}
                        >
                            {/* 1. Recommended */}
                            <View style={styles.sheetSectionGroup}>
                                <Text style={styles.sheetSectionLabel}>{isHi ? 'अनुशंसित' : 'Recommended'}</Text>
                                <View style={styles.groupCard}>
                                    {[
                                        { id: 'phonepe', name: 'PhonePe UPI' },
                                        { id: 'gpay', name: 'Google Pay UPI' },
                                        { id: 'paytm', name: 'Paytm UPI' },
                                    ].map((item, idx) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[styles.methodRow, idx > 0 && styles.rowBorderTop, selectedPayment === item.id && styles.activeMethodRow]}
                                            onPress={() => setSelectedPayment(item.id)}
                                        >
                                            <View style={styles.methodLeftInfo}>
                                                <View style={styles.methodIconBadge}>
                                                    <SmartPhone01Icon size={18} color="#6C3CF4" strokeWidth={2} />
                                                </View>
                                                <Text style={styles.methodTitle}>{item.name}</Text>
                                            </View>
                                            {selectedPayment === item.id ? (
                                                <CheckmarkCircle01Icon size={20} color="#6C3CF4" strokeWidth={2.2} />
                                            ) : (
                                                <ArrowRight01Icon size={16} color="#94A3B8" strokeWidth={2} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* 2. Cards */}
                            <View style={styles.sheetSectionGroup}>
                                <Text style={styles.sheetSectionLabel}>{isHi ? 'कार्ड्स' : 'Cards'}</Text>
                                <View style={styles.groupCard}>
                                    <TouchableOpacity 
                                        style={[styles.methodRow, selectedPayment === 'card' && styles.activeMethodRow]}
                                        onPress={() => setSelectedPayment('card')}
                                    >
                                        <View style={styles.methodLeftInfo}>
                                            <View style={styles.methodIconBadge}>
                                                <CreditCardIcon size={18} color="#6C3CF4" strokeWidth={2} />
                                            </View>
                                            <Text style={styles.methodTitle}>{isHi ? 'क्रेडिट या डेबिट कार्ड जोड़ें' : 'Add credit or debit cards'}</Text>
                                        </View>
                                        <Text style={styles.addBtnLabel}>{isHi ? 'जोड़ें' : 'ADD'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.methodRow, styles.rowBorderTop, selectedPayment === 'pluxee' && styles.activeMethodRow]}
                                        onPress={() => setSelectedPayment('pluxee')}
                                    >
                                        <View style={styles.methodLeftInfo}>
                                            <View style={styles.methodIconBadge}>
                                                <CreditCardIcon size={18} color="#6C3CF4" strokeWidth={2} />
                                            </View>
                                            <Text style={styles.methodTitle}>Pluxee / Sodexo</Text>
                                        </View>
                                        <Text style={styles.addBtnLabel}>{isHi ? 'जोड़ें' : 'ADD'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 3. Pay by any UPI app */}
                            <View style={styles.sheetSectionGroup}>
                                <Text style={styles.sheetSectionLabel}>{isHi ? 'किसी भी UPI ऐप से भुगतान करें' : 'Pay by any UPI app'}</Text>
                                <View style={styles.groupCard}>
                                    {[
                                        { id: 'phonepe', name: 'PhonePe UPI' },
                                        { id: 'paytm', name: 'Paytm UPI' },
                                        { id: 'amazon_upi', name: 'Amazon Pay UPI' },
                                        { id: 'super_upi', name: 'Supermoney UPI' },
                                        { id: 'add_upi', name: 'Add new UPI ID', isAdd: true },
                                    ].map((item, idx) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[styles.methodRow, idx > 0 && styles.rowBorderTop, selectedPayment === item.id && styles.activeMethodRow]}
                                            onPress={() => setSelectedPayment(item.id)}
                                        >
                                            <View style={styles.methodLeftInfo}>
                                                <View style={styles.methodIconBadge}>
                                                    <SmartPhone01Icon size={18} color="#6C3CF4" strokeWidth={2} />
                                                </View>
                                                <Text style={styles.methodTitle}>{item.name}</Text>
                                            </View>
                                            {item.isAdd ? (
                                                <Text style={styles.addBtnLabel}>{isHi ? 'जोड़ें' : 'ADD'}</Text>
                                            ) : selectedPayment === item.id ? (
                                                <CheckmarkCircle01Icon size={20} color="#6C3CF4" strokeWidth={2.2} />
                                            ) : (
                                                <ArrowRight01Icon size={16} color="#94A3B8" strokeWidth={2} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* 4. Wallets */}
                            <View style={styles.sheetSectionGroup}>
                                <Text style={styles.sheetSectionLabel}>{isHi ? 'वॉलेट' : 'Wallets'}</Text>
                                <View style={styles.groupCard}>
                                    {[
                                        { id: 'wallet_sk', name: 'Shravan Kirana Money', sub: 'Balance: ₹0' },
                                        { id: 'amazon_wallet', name: 'Amazon Pay Balance', sub: 'Link your Amazon Pay Balance wallet', isAdd: true },
                                        { id: 'mobikwik', name: 'Mobikwik', sub: 'Link your Mobikwik wallet', isAdd: true },
                                    ].map((item, idx) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={[styles.methodRow, idx > 0 && styles.rowBorderTop, selectedPayment === item.id && styles.activeMethodRow]}
                                            onPress={() => setSelectedPayment(item.id)}
                                        >
                                            <View style={styles.methodLeftInfo}>
                                                <View style={styles.methodIconBadge}>
                                                    <Wallet01Icon size={18} color="#6C3CF4" strokeWidth={2} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.methodTitle}>{item.name}</Text>
                                                    {item.sub && <Text style={styles.methodSubtext}>{item.sub}</Text>}
                                                </View>
                                            </View>
                                            {item.isAdd ? (
                                                <Text style={styles.addBtnLabel}>{isHi ? 'जोड़ें' : 'ADD'}</Text>
                                            ) : selectedPayment === item.id ? (
                                                <CheckmarkCircle01Icon size={20} color="#6C3CF4" strokeWidth={2.2} />
                                            ) : (
                                                <ArrowRight01Icon size={16} color="#94A3B8" strokeWidth={2} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* 5. Netbanking */}
                            <View style={styles.sheetSectionGroup}>
                                <Text style={styles.sheetSectionLabel}>{isHi ? 'नेटबैंकिंग' : 'Netbanking'}</Text>
                                <View style={styles.groupCard}>
                                    <TouchableOpacity
                                        style={[styles.methodRow, selectedPayment === 'netbanking' && styles.activeMethodRow]}
                                        onPress={() => setSelectedPayment('netbanking')}
                                    >
                                        <View style={styles.methodLeftInfo}>
                                            <View style={styles.methodIconBadge}>
                                                <BankIcon size={18} color="#6C3CF4" strokeWidth={2} />
                                            </View>
                                            <Text style={styles.methodTitle}>{isHi ? 'नेटबैंकिंग' : 'Netbanking'}</Text>
                                        </View>
                                        <Text style={styles.addBtnLabel}>{isHi ? 'जोड़ें' : 'ADD'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* 6. Pay On Delivery */}
                            <View style={styles.sheetSectionGroup}>
                                <Text style={styles.sheetSectionLabel}>{isHi ? 'डिलीवरी पर भुगतान' : 'Pay On Delivery'}</Text>
                                <View style={styles.groupCard}>
                                    <TouchableOpacity
                                        style={[styles.methodRow, selectedPayment === 'cod' && styles.activeMethodRow]}
                                        onPress={() => setSelectedPayment('cod')}
                                    >
                                        <View style={styles.methodLeftInfo}>
                                            <View style={styles.methodIconBadge}>
                                                <Cash01Icon size={18} color="#6C3CF4" strokeWidth={2} />
                                            </View>
                                            <Text style={styles.methodTitle}>{isHi ? 'कैश ऑन डिलीवरी' : 'Cash on Delivery'}</Text>
                                        </View>
                                        {selectedPayment === 'cod' ? (
                                            <CheckmarkCircle01Icon size={20} color="#6C3CF4" strokeWidth={2.2} />
                                        ) : (
                                            <ArrowRight01Icon size={16} color="#94A3B8" strokeWidth={2} />
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.codNoteBanner}>
                                        <Text style={styles.codNoteText}>
                                            {isHi
                                                ? '₹100 से कम के पहले ऑर्डर के लिए कैश ऑन डिलीवरी उपलब्ध नहीं है।'
                                                : 'Cash on delivery is not available for first order below ₹100.'}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View style={{ height: 20 }} />
                        </ScrollView>

                        {/* Sticky Action Footer inside Payment Modal */}
                        <View style={styles.sheetFooterContainer}>
                            <TouchableOpacity
                                style={styles.sheetPayBtn}
                                onPress={handleInitiatePayment}
                                activeOpacity={0.9}
                            >
                                <View style={styles.sheetPayBtnContent}>
                                    <View>
                                        <Text style={styles.sheetPayBtnPrice}>₹{grandTotal}</Text>
                                        <Text style={styles.sheetPayBtnSub}>{isHi ? 'कुल देय राशि' : 'TOTAL PAYABLE'}</Text>
                                    </View>
                                    <View style={styles.sheetPayBtnRight}>
                                        <Text style={styles.sheetPayBtnText}>
                                            {selectedPayment === 'cod'
                                                ? (isHi ? 'ऑर्डर कन्फर्म करें' : 'Confirm Order')
                                                : (isHi ? 'भुगतान करें और आगे बढ़ें' : 'Pay & Continue')}
                                        </Text>
                                        <ArrowRight01Icon size={16} color={COLORS.white} strokeWidth={3} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Realistic Payment Gateway Processing Modal Overlay */}
            <Modal
                visible={isProcessingPayment}
                transparent
                animationType="fade"
                onRequestClose={() => {}}
            >
                <View style={styles.paymentModalOverlay}>
                    <View style={styles.paymentModalCard}>
                        {/* Security Header Badge */}
                        <View style={styles.securityBadge}>
                            <LockIcon size={14} color="#10B981" strokeWidth={2.5} />
                            <Text style={styles.securityBadgeText}>256-BIT SECURE PAYMENT</Text>
                        </View>

                        <Text style={styles.paymentAmountTitle}>₹{grandTotal}</Text>
                        <Text style={styles.paymentProviderSub}>
                            {selectedPayment === 'cod'
                                ? (isHi ? 'कैश ऑन डिलीवरी वेरिफिकेशन' : 'Cash on Delivery Order')
                                : (isHi ? `${getPaymentDisplayName(selectedPayment)} से भुगतान किया जा रहा है` : `Paying via ${getPaymentDisplayName(selectedPayment)}`)}
                        </Text>

                        {/* Animated Processing / Success Status */}
                        <View style={styles.paymentStatusContainer}>
                            {paymentStep === 2 ? (
                                <View style={styles.paymentSuccessCircle}>
                                    <CheckmarkCircle01Icon size={44} color="#10B981" strokeWidth={2.5} />
                                </View>
                            ) : (
                                <View style={styles.paymentLoaderCircle}>
                                    <ActivityIndicator size="large" color="#6C3CF4" />
                                </View>
                            )}

                            <Text style={styles.paymentStepText}>
                                {paymentStep === 0 && (isHi ? 'बैंक पेमेंट गेटवे से सुरक्षित रूप से जुड़ रहा है...' : 'Connecting securely to payment gateway...')}
                                {paymentStep === 1 && (selectedPayment === 'cod'
                                    ? (isHi ? 'आपका ऑर्डर तैयार किया जा रहा है...' : 'Preparing your order...')
                                    : (isHi ? 'आपके भुगतान की पुष्टि की जा रही है...' : 'Confirming your payment with the bank...'))}
                                {paymentStep === 2 && (selectedPayment === 'cod'
                                    ? (isHi ? 'ऑर्डर कन्फर्म हो गया ✓' : 'Order Confirmed ✓')
                                    : (isHi ? 'भुगतान सफल! ऑर्डर कन्फर्म हो गया ✓' : 'Payment Approved! Order Confirmed ✓'))}
                                {paymentStep === 3 && (isHi
                                    ? 'भुगतान की पुष्टि में समय लग रहा है। दोबारा भुगतान न करें।'
                                    : 'Still verifying your payment. This can take a few minutes - please do not pay again.')}
                            </Text>

                            {paymentStep !== 3 && (
                                <Text style={styles.paymentWarningText}>
                                    {isHi ? 'कृपया ऐप बंद न करें और न ही बैक बटन दबाएं' : 'Please do not close the app or press back'}
                                </Text>
                            )}
                        </View>

                        {/* Cancel is only offered before anything has been charged */}
                        {paymentStep === 0 && (
                            <TouchableOpacity
                                style={styles.cancelPaymentBtn}
                                onPress={cancelPaymentProcess}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.cancelPaymentText}>{isHi ? 'भुगतान रद्द करें' : 'Cancel Payment'}</Text>
                            </TouchableOpacity>
                        )}

                        {paymentStep === 3 && (
                            <>
                                <TouchableOpacity
                                    style={styles.cancelPaymentBtn}
                                    onPress={() => verifyPayment(pendingOrderIdRef.current)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.cancelPaymentText}>{isHi ? 'फिर से जांचें' : 'Check again'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.cancelPaymentBtn}
                                    onPress={closeVerification}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.cancelPaymentText}>{isHi ? 'बंद करें' : 'Close'}</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* PayU checkout WebView (native). Completion is detected from the
                backend return URL and then verified by polling the order. */}
            <Modal
                visible={!!payuRequest}
                animationType="slide"
                onRequestClose={handlePayuClosed}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={handlePayuClosed}
                            style={styles.backButton}
                        >
                            <ArrowLeft02Icon size={24} color={COLORS.text} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{isHi ? 'सुरक्षित भुगतान' : 'Secure Payment'}</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    {payuRequest && (
                        <WebView
                            source={{
                                uri: payuRequest.url,
                                method: 'POST',
                                body: payuRequest.body,
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            }}
                            style={{ flex: 1 }}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            originWhitelist={['*']}
                            onShouldStartLoadWithRequest={handlePayuNavigation}
                            onNavigationStateChange={(navState) => {
                                handlePayuReturn(navState.url);
                            }}
                        />
                    )}
                </SafeAreaView>
            </Modal>


        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAF9F6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 16,
        paddingBottom: 16,
        backgroundColor: '#FAF9F6',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
    },
    cartIconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#6C3CF4',
        borderRadius: 10,
        paddingHorizontal: 5,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
    },
    cartBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: COLORS.white,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 22,
        padding: 18,
        marginBottom: 16,
        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    addressTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pinBadge: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    verifiedCheck: {
        position: 'absolute',
        bottom: -2,
        right: -2,
    },
    deliveringToLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    addressType: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
    },
    changeBtn: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
    },
    changeBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    addressDetails: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    recipientName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    fullAddress: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    phoneText: {
        fontSize: 12,
        color: COLORS.textLight,
        marginTop: 4,
        fontWeight: '500',
    },
    etaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        marginTop: 14,
        gap: 8,
    },
    etaBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#D97706',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    cardSectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 14,
    },
    tapToEditHint: {
        fontSize: 11,
        color: COLORS.textLight,
        fontWeight: '500',
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    itemImage: {
        width: 48,
        height: 48,
        borderRadius: 10,
        backgroundColor: '#F9FAFB',
    },
    itemDetails: {
        flex: 1,
        marginLeft: 12,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    itemVariant: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '800',
        color: COLORS.text,
        marginTop: 4,
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        padding: 4,
        gap: 8,
    },
    stepperBtn: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperQty: {
        fontSize: 13,
        fontWeight: '800',
        color: '#334155',
        minWidth: 16,
        textAlign: 'center',
    },
    addMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        marginTop: 12,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    addMoreText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6C3CF4',
    },
    prefRow: {
        flexDirection: 'row',
        gap: 12,
    },
    prefCard: {
        flex: 1,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: COLORS.white,
    },
    prefCardActive: {
        borderColor: '#6C3CF4',
        backgroundColor: '#FAF5FF',
    },
    radioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: COLORS.textLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCircleActive: {
        borderColor: '#6C3CF4',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#6C3CF4',
    },
    prefTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },
    prefTitleActive: {
        color: '#6C3CF4',
    },
    prefBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 4,
    },
    prefBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#D97706',
    },
    prefSubtext: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 8,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    instructionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        gap: 6,
    },
    instructionChipActive: {
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    chipTextActive: {
        color: '#B45309',
        fontWeight: '700',
    },
    instructionInput: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        fontSize: 13,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minHeight: 48,
    },
    couponHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    couponScrollView: {
        marginHorizontal: -4,
    },
    couponCard: {
        width: 220,
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 16,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    couponCardApplied: {
        borderColor: '#6C3CF4',
        backgroundColor: '#FAF5FF',
    },
    couponCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    couponCodeText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#6C3CF4',
        letterSpacing: 0.5,
    },
    couponPill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    couponPillText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#D97706',
    },
    couponSubtitle: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 4,
        marginBottom: 12,
    },
    applyBtn: {
        backgroundColor: COLORS.white,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#6C3CF4',
    },
    appliedBtn: {
        backgroundColor: '#6C3CF4',
        borderColor: '#6C3CF4',
    },
    applyBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6C3CF4',
    },
    appliedBtnText: {
        color: COLORS.white,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    billLabel: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    billValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    freeText: {
        color: '#10B981',
        fontWeight: '800',
    },
    billDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 10,
    },
    grandTotalLabel: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.text,
    },
    grandTotalValue: {
        fontSize: 20,
        fontWeight: '900',
        color: COLORS.text,
    },
    savingsBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        padding: 12,
        borderRadius: 12,
        marginTop: 14,
        gap: 8,
    },
    savingsBannerText: {
        fontSize: 13,
        color: COLORS.text,
        fontWeight: '500',
    },
    savingsBold: {
        fontWeight: '800',
        color: '#D97706',
    },
    paymentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        marginBottom: 10,
    },
    paymentCardActive: {
        borderColor: '#6C3CF4',
        backgroundColor: '#FAF5FF',
    },
    paymentIconWrapper: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentTextCol: {
        flex: 1,
        marginLeft: 12,
    },
    paymentName: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
    },
    paymentNameActive: {
        color: '#6C3CF4',
    },
    paymentSub: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    popularBadge: {
        backgroundColor: '#6C3CF4',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    popularBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: COLORS.white,
    },
    helpCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 22,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    helpHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    helpIconCircle: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    helpTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
    },
    helpSub: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    helpActionsRow: {
        flexDirection: 'row',
        marginTop: 14,
        gap: 10,
    },
    helpBtn: {
        flex: 1,
        backgroundColor: '#6C3CF4',
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    helpBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.white,
    },
    helpBtnOutline: {
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    helpBtnOutlineText: {
        color: '#475569',
    },
    noteCard: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        padding: 14,
        marginBottom: 16,
    },
    noteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    noteDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 10,
    },
    noteText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    paymentTriggerCard: {
        backgroundColor: COLORS.white,
        borderRadius: 22,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    paymentTriggerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    paymentTriggerIconBox: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentTriggerSub: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    paymentTriggerTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.text,
        marginTop: 2,
    },
    changeMethodBtnPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    changeMethodText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    bottomBarContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 74 : 68,
        left: 0,
        right: 0,
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 12,
        zIndex: 10,
    },
    addressBarPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    addressBarPillLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        marginRight: 8,
    },
    homeIconSmall: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressPillTitle: {
        fontSize: 12,
        color: '#1E293B',
    },
    addressPillSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    changeTextPill: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6C3CF4',
    },
    bottomActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    payUsingTrigger: {
        flex: 1,
        justifyContent: 'center',
    },
    payUsingHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    payUsingText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#6C3CF4',
        letterSpacing: 0.5,
    },
    selectedPayName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 2,
    },
    placeOrderPillBtn: {
        backgroundColor: '#6C3CF4',
        borderRadius: 18,
        paddingHorizontal: 20,
        paddingVertical: 12,
        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
    },
    placeOrderBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    priceCol: {
        alignItems: 'flex-start',
    },
    pillPriceText: {
        fontSize: 16,
        fontWeight: '900',
        color: COLORS.white,
    },
    pillTotalLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.8)',
    },
    placeOrderActionRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pillActionText: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.white,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'flex-end',
    },
    bottomSheetContainer: {
        backgroundColor: '#FAF9F6',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: '82%',
        paddingTop: 12,
        paddingHorizontal: 16,
    },
    sheetHeader: {
        alignItems: 'center',
        paddingBottom: 14,
    },
    dragHandleBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5E1',
        marginBottom: 12,
    },
    sheetTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: '100%',
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    sheetScrollContent: {
        paddingBottom: 20,
    },
    sheetSectionGroup: {
        marginBottom: 16,
    },
    sheetSectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
        marginLeft: 4,
    },
    groupCard: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    rowBorderTop: {
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
    },
    activeMethodRow: {
        backgroundColor: '#F3E8FF',
    },
    methodLeftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        marginRight: 10,
    },
    methodIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    methodTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    methodSubtext: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    addBtnLabel: {
        fontSize: 13,
        fontWeight: '800',
        color: '#16A34A',
    },
    codNoteBanner: {
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#FEE2E2',
    },
    codNoteText: {
        fontSize: 11,
        color: '#EF4444',
        fontWeight: '500',
        lineHeight: 15,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.white,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
    },
    bottomBarLeft: {
        flex: 1,
    },
    bottomGrandTotal: {
        fontSize: 22,
        fontWeight: '900',
        color: COLORS.text,
    },
    bottomSavingsPill: {
        backgroundColor: '#F3E8FF',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 3,
    },
    bottomSavingsText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#6C3CF4',
    },
    placeOrderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6C3CF4',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 18,
        gap: 10,
        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    placeOrderBtnDisabled: {
        opacity: 0.7,
    },
    placeOrderText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '800',
    },
    arrowIconWrapper: {
        width: 24,
        height: 24,
        borderRadius: 8,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Payment Bottom Sheet Footer
    sheetFooterContainer: {
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        backgroundColor: COLORS.white,
    },
    sheetPayBtn: {
        backgroundColor: '#6C3CF4',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        shadowColor: '#6C3CF4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    sheetPayBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sheetPayBtnPrice: {
        fontSize: 18,
        fontWeight: '900',
        color: COLORS.white,
    },
    sheetPayBtnSub: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.8)',
        letterSpacing: 0.5,
    },
    sheetPayBtnRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sheetPayBtnText: {
        fontSize: 15,
        fontWeight: '800',
        color: COLORS.white,
    },
    // Payment Gateway Processing Modal Overlay
    paymentModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    paymentModalCard: {
        width: '100%',
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    securityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
        marginBottom: 16,
    },
    securityBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#059669',
        letterSpacing: 0.5,
    },
    paymentAmountTitle: {
        fontSize: 34,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 4,
    },
    paymentProviderSub: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
        textAlign: 'center',
    },
    paymentStatusContainer: {
        alignItems: 'center',
        marginVertical: 20,
        width: '100%',
    },
    paymentLoaderCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F3E8FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    paymentSuccessCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    paymentStepText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: 8,
        lineHeight: 22,
        paddingHorizontal: 8,
    },
    paymentWarningText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#94A3B8',
        textAlign: 'center',
    },
    cancelPaymentBtn: {
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
    },
    cancelPaymentText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#EF4444',
    },
});

export default CheckoutScreen;

