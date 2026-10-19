/**
 * Payment options shown in the PaymentMethodSheet. The ids are the keys that
 * services/paymentService.js maps to an order paymentMethod and a PayU pg
 * (UPI / CC / NB), so never rename them here without updating that file.
 *
 * PayU's hosted page does the actual work for online methods: we only pick the
 * category and PayU asks for the details (UPI app or ID, card, bank). So the sheet
 * offers honest categories, not third-party app logos or wallets we don't run.
 * No wallet until the store has one (DESIGN.md).
 */

export const DEFAULT_PAYMENT = 'upi';

export const getPaymentGroups = (isHi) => [
    {
        key: 'online',
        title: isHi ? 'ऑनलाइन भुगतान' : 'Pay online',
        options: [
            {
                id: 'upi',
                name: 'UPI',
                sub: isHi ? 'कोई भी UPI ऐप या UPI ID' : 'Any UPI app or UPI ID',
                icon: 'cellphone-check',
            },
            {
                id: 'card',
                name: isHi ? 'क्रेडिट / डेबिट कार्ड' : 'Credit or debit card',
                sub: 'Visa, Mastercard, RuPay',
                icon: 'credit-card-outline',
            },
            {
                id: 'netbanking',
                name: isHi ? 'नेट बैंकिंग' : 'Net banking',
                sub: isHi ? 'सभी प्रमुख भारतीय बैंक' : 'All major Indian banks',
                icon: 'bank-outline',
            },
        ],
    },
    {
        key: 'cod',
        title: isHi ? 'डिलीवरी पर भुगतान' : 'Pay on delivery',
        options: [
            {
                id: 'cod',
                name: isHi ? 'कैश ऑन डिलीवरी' : 'Cash on delivery',
                sub: isHi ? 'डिलीवरी पर कैश या UPI से भुगतान करें' : 'Pay by cash or UPI at your door',
                icon: 'cash',
            },
        ],
    },
];

/** True for an id the sheet still offers (a stale saved id falls back to the default). */
export const isPaymentOption = (id, isHi) => getPaymentGroups(isHi).some((g) => g.options.some((o) => o.id === id));

export const findPaymentOption = (id, isHi) => {
    const groups = getPaymentGroups(isHi);
    for (const group of groups) {
        const match = group.options.find((o) => o.id === id);
        if (match) return match;
    }
    return groups[0].options[0];
};

