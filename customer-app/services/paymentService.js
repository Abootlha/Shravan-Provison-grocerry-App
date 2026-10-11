import { Platform } from 'react-native';
import PayUSdk from 'payu-core-pg-react';
import { orderApi } from './api';
import { ENDPOINTS } from './config';

// Payment flow (online methods):
//   1. createOrder()           -> server creates the order with paymentStatus PENDING
//   2. requestPaymentHash()    -> server computes amount/customer/urls/hash for that order
//   3. PayU                    -> web: auto-submitted form; native: WebView POST
//                                 (request built by payu-core-pg-react where it can)
//   4. pollOrderPayment()      -> the order's paymentStatus is the only proof of payment.
// PayU redirects (?payment=success) and SDK callbacks are never trusted as success.

const PAYU_URLS = {
    production: 'https://secure.payu.in/_payment',
    test: 'https://test.payu.in/_payment',
};

// UI payment option -> order.paymentMethod understood by the backend.
export const PAYMENT_METHOD_MAP = {
    phonepe: 'UPI',
    paytm: 'UPI',
    gpay: 'UPI',
    amazon_upi: 'UPI',
    super_upi: 'UPI',
    add_upi: 'UPI',
    upi: 'UPI',
    cod: 'COD',
    card: 'CARD',
    pluxee: 'CARD',
    netbanking: 'CARD',
    wallet: 'WALLET',
    wallet_sk: 'WALLET',
    amazon_wallet: 'WALLET',
    mobikwik: 'WALLET',
};

// UI payment option -> PayU `pg` / `bankcode`. pg values are PayU's categories
// (UPI, CC, NB, CASH = wallets). Leaving bankcode out lets PayU's hosted page
// ask for the detail (bank, VPA, wallet) instead of failing a seamless request.
export const getPayUOptions = (selectedPayment) => {
    switch (selectedPayment) {
        case 'gpay': return { pg: 'UPI', bankcode: 'TEZ' };
        case 'phonepe':
        case 'paytm':
        case 'amazon_upi':
        case 'super_upi':
        case 'upi':
            return { pg: 'UPI', bankcode: 'INTENT' };
        case 'add_upi': return { pg: 'UPI' };
        case 'card': return { pg: 'CC' };
        case 'pluxee': return { pg: 'CC' };
        case 'netbanking': return { pg: 'NB' };
        case 'amazon_wallet': return { pg: 'CASH', bankcode: 'AMAZONPAY' };
        case 'mobikwik': return { pg: 'CASH', bankcode: 'MOBIKWIK' };
        case 'wallet':
        case 'wallet_sk':
            return { pg: 'CASH' };
        default: return { pg: 'UPI', bankcode: 'INTENT' };
    }
};

const extractOrderId = (response) => {
    const order = response?.order || response;
    return order?.orderId || order?._id || order?.id || response?.orderId || null;
};

export const createOrder = async (orderData) => {
    const response = await orderApi.post(ENDPOINTS.orders.LIST, orderData);
    const orderId = extractOrderId(response.data);
    if (!orderId) {
        throw new Error('Order was created but the server did not return an orderId');
    }
    return { orderId, order: response.data?.order || response.data };
};

export const requestPaymentHash = async ({ orderId, pg, bankcode }) => {
    const body = { orderId };
    if (pg) body.pg = pg;
    if (bankcode) body.bankcode = bankcode;
    const response = await orderApi.post('/payments/seamless-hash', body);
    const hashData = response.data?.data || response.data;
    if (!hashData?.hash || !hashData?.key || !hashData?.txnid) {
        throw new Error('Invalid payment hash response');
    }
    return hashData;
};

const isProductionEnvironment = (environment) => {
    // PayU SDK convention: "0" = production, "1" = test.
    if (environment === undefined || environment === null || environment === '') return true;
    return ['0', 'production', 'prod', 'live'].includes(String(environment).toLowerCase());
};

export const getPayUUrl = (hashData) => (
    isProductionEnvironment(hashData.environment) ? PAYU_URLS.production : PAYU_URLS.test
);

const FORM_FIELDS = ['key', 'txnid', 'amount', 'productinfo', 'firstname', 'email', 'phone', 'surl', 'furl', 'hash', 'pg', 'bankcode'];

export const getPayUFormFields = (hashData) => FORM_FIELDS.reduce((fields, name) => {
    const value = hashData[name];
    if (value !== undefined && value !== null && value !== '') {
        fields[name] = String(value);
    }
    return fields;
}, {});

const toFormBody = (fields) => Object.entries(fields)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');

/** Web: post the server-signed fields to PayU (the page navigates away). */
export const submitPayUFormOnWeb = (hashData) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = getPayUUrl(hashData);
    form.style.display = 'none';

    Object.entries(getPayUFormFields(hashData)).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
};

// payu-core-pg-react `paymentType` values (see PayuConstantsCorePG / PayUSdk.m).
// Only the types that need no extra customer input (card number, VPA) are
// sent through the SDK; the rest use PayU's hosted page.
const getSdkPaymentType = ({ pg, bankcode }) => {
    if (pg === 'NB' && bankcode) return 'Net Banking';
    if (pg === 'CASH' && bankcode) return 'Cash Card';
    if (pg === 'UPI' && bankcode === 'TEZ') return 'upi';
    return null;
};

const isSdkAvailable = () => Platform.OS !== 'web'
    && PayUSdk
    && typeof PayUSdk.makePayment === 'function';

const buildRequestWithSdk = (hashData, paymentType) => new Promise((resolve, reject) => {
    const params = {
        key: hashData.key,
        environment: isProductionEnvironment(hashData.environment) ? '0' : '1',
        amount: String(hashData.amount),
        txnId: hashData.txnid,
        productInfo: hashData.productinfo,
        firstName: hashData.firstname,
        email: hashData.email,
        phone: hashData.phone,
        surl: hashData.surl,
        furl: hashData.furl,
        hash: hashData.hash,
        userCredentials: `${hashData.key}:${hashData.email || hashData.phone}`,
        paymentType,
        bankCode: hashData.bankcode,
        udf1: '',
        udf2: '',
        udf3: '',
        udf4: '',
        udf5: '',
    };

    try {
        // makePayment does not charge anything: it returns the signed POST
        // request ({ url, data }) that must be loaded in a WebView.
        PayUSdk.makePayment(
            params,
            (response) => {
                try {
                    const parsed = typeof response === 'string' ? JSON.parse(response) : response;
                    if (parsed?.url && parsed?.data) {
                        resolve({ url: parsed.url, body: parsed.data });
                    } else {
                        reject(new Error('PayU SDK returned no request'));
                    }
                } catch (error) {
                    reject(error);
                }
            },
            (error) => reject(error instanceof Error ? error : new Error(JSON.stringify(error))),
        );
    } catch (error) {
        reject(error);
    }
});

/**
 * Native: returns the POST request to load in a WebView.
 * Uses the PayU SDK when the selected method supports it, else the hosted page.
 */
export const getNativePaymentRequest = async (hashData, payuOptions) => {
    const paymentType = getSdkPaymentType(payuOptions);
    if (paymentType && isSdkAvailable()) {
        try {
            return await buildRequestWithSdk(hashData, paymentType);
        } catch (error) {
            if (__DEV__) console.warn('PayU SDK request failed, using hosted checkout:', error?.message);
        }
    }
    return {
        url: getPayUUrl(hashData),
        body: toFormBody(getPayUFormFields(hashData)),
    };
};

/** Parses the backend's PAYMENT_RETURN_URL redirect (?payment=success|failed&orderId=...). */
export const parsePaymentReturnUrl = (url) => {
    if (!url || !/[?&]payment=(success|failed)/.test(url)) return null;
    const query = url.split('?')[1] || '';
    const params = {};
    query.split('#')[0].split('&').forEach((pair) => {
        const [rawKey, rawValue = ''] = pair.split('=');
        if (rawKey) params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    });
    return { payment: params.payment, orderId: params.orderId || null };
};

export const PAYMENT_RESULT = {
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    TIMEOUT: 'TIMEOUT',
    CANCELLED: 'CANCELLED',
};

const getOrderPaymentState = async (orderId) => {
    const response = await orderApi.get(ENDPOINTS.orders.DETAIL(orderId));
    const order = response.data?.order || response.data || {};
    const paymentStatus = String(order.paymentStatus || '').toUpperCase();
    const orderStatus = String(order.orderStatus || order.status || '').toUpperCase();

    if (paymentStatus === 'COMPLETED') return PAYMENT_RESULT.COMPLETED;
    if (paymentStatus === 'FAILED' || orderStatus === 'CANCELLED') return PAYMENT_RESULT.FAILED;
    return null;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls GET /orders/:orderId until the server has verified the payment.
 * Resolves COMPLETED, FAILED, TIMEOUT (still PENDING after timeoutMs) or
 * CANCELLED (shouldStop() returned true, e.g. the screen unmounted).
 */
export const pollOrderPayment = async (orderId, {
    timeoutMs = 60000,
    intervalMs = 3000,
    shouldStop = () => false,
} = {}) => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (shouldStop()) return PAYMENT_RESULT.CANCELLED;
        try {
            const result = await getOrderPaymentState(orderId);
            if (result) return result;
        } catch (error) {
            // Transient network/server errors: keep polling until the deadline.
            if (__DEV__) console.warn('Payment status check failed:', error?.message);
        }
        if (shouldStop()) return PAYMENT_RESULT.CANCELLED;
        await wait(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
    }

    return PAYMENT_RESULT.TIMEOUT;
};

/** One-shot status check (e.g. after the user closes the payment page). */
export const checkOrderPayment = async (orderId) => {
    try {
        return (await getOrderPaymentState(orderId)) || null;
    } catch {
        return null;
    }
};
