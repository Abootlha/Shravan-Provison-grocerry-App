/**
 * Payment options shown in the PaymentMethodSheet. The ids are the keys that
 * services/paymentService.js maps to an order paymentMethod and a PayU pg/bankcode,
 * so never rename them here without updating that file.
 */

const UPI_ICON = 'contactless-payment';

export const getPaymentGroups = (isHi) => [
    {
        key: 'upi',
        title: isHi ? 'UPI ऐप से भुगतान करें' : 'Pay by UPI app',
        options: [
            { id: 'phonepe', name: 'PhonePe UPI', icon: UPI_ICON, tint: 'lilac' },
            { id: 'gpay', name: 'Google Pay UPI', icon: UPI_ICON, tint: 'sky' },
            { id: 'paytm', name: 'Paytm UPI', icon: UPI_ICON, tint: 'mint' },
            { id: 'amazon_upi', name: 'Amazon Pay UPI', icon: UPI_ICON, tint: 'peach' },
            { id: 'super_upi', name: 'Supermoney UPI', icon: UPI_ICON, tint: 'violet' },
            {
                id: 'add_upi',
                name: isHi ? 'किसी भी UPI ID से भुगतान' : 'Pay with any UPI ID',
                sub: isHi ? 'अगले पेज पर अपनी UPI ID डालें' : 'Enter your UPI ID on the next page',
                icon: 'at',
                tint: 'violet',
            },
        ],
    },
    {
        key: 'cards',
        title: isHi ? 'कार्ड' : 'Cards',
        options: [
            {
                id: 'card',
                name: isHi ? 'क्रेडिट / डेबिट कार्ड' : 'Credit or debit card',
                sub: 'Visa, Mastercard, RuPay',
                icon: 'credit-card-outline',
                tint: 'sky',
            },
            { id: 'pluxee', name: 'Pluxee / Sodexo', sub: isHi ? 'मील कार्ड' : 'Meal card', icon: 'card-account-details-outline', tint: 'rose' },
        ],
    },
    {
        key: 'netbanking',
        title: isHi ? 'नेट बैंकिंग' : 'Net banking',
        options: [
            {
                id: 'netbanking',
                name: isHi ? 'नेट बैंकिंग' : 'Net banking',
                sub: isHi ? 'सभी प्रमुख भारतीय बैंक' : 'All major Indian banks',
                icon: 'bank-outline',
                tint: 'mint',
            },
        ],
    },
    {
        key: 'wallets',
        title: isHi ? 'वॉलेट' : 'Wallets',
        options: [
            { id: 'wallet_sk', name: 'Shravan Kirana Money', sub: isHi ? 'बैलेंस: ₹0' : 'Balance: ₹0', icon: 'wallet-outline', tint: 'violet' },
            { id: 'amazon_wallet', name: 'Amazon Pay Balance', icon: 'wallet-outline', tint: 'peach' },
            { id: 'mobikwik', name: 'Mobikwik', icon: 'wallet-outline', tint: 'sky' },
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
                tint: 'mint',
            },
        ],
    },
];

const FALLBACK = { id: 'phonepe', name: 'PhonePe UPI', icon: UPI_ICON, tint: 'lilac' };

export const findPaymentOption = (id, isHi) => {
    for (const group of getPaymentGroups(isHi)) {
        const match = group.options.find((o) => o.id === id);
        if (match) return match;
    }
    return FALLBACK;
};
