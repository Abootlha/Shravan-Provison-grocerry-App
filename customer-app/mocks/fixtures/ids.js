// Deterministic 24-hex ids so mock ids pass the app's Mongo ObjectId checks
// (CheckoutScreen rejects cart items whose productId is not /^[a-f\d]{24}$/).
// `kind` must be hex.
export const oid = (kind, n) => `${kind}${Number(n).toString(16).padStart(24 - kind.length, '0')}`;

export const KIND = {
    category: 'ca',
    subcategory: 'cb',
    itemGroup: 'cc',
    brand: 'bd',
    product: 'a0',
    order: 'd0',
    user: 'e0',
    rider: 'f0',
};

export const unsplash = (photoId) => `https://images.unsplash.com/photo-${photoId}?w=400&q=70`;

// Wraps text into <=3 short lines (placehold.co breaks on a literal "\n") so
// the label stays large enough to read on a product card.
const wrap = (text, width = 14) => {
    const lines = [];
    String(text).split(/\s+/).forEach((word) => {
        const last = lines[lines.length - 1];
        if (last && `${last} ${word}`.length <= width) lines[lines.length - 1] = `${last} ${word}`;
        else lines.push(word);
    });
    return lines.slice(0, 3).join('\\n');
};

export const placeholder = (text, bg = 'F1F5F9', fg = '334155') => (
    `https://placehold.co/400x400/${bg}/${fg}/png?font=poppins&text=${encodeURIComponent(wrap(text)).replace(/%20/g, '+')}`
);
