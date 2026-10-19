/**
 * Clean catalogue product names for display. Raw names come from many sources and carry pack sizes,
 * prices, SEO tails and shouting caps:
 *   "58gm Parle Monaco Classic Biscuit"                       → "Parle Monaco Classic Biscuit"
 *   "KRACK JACK BISCUITS 10 RS PACK"                          → "Krack Jack Biscuits"
 *   "Parle Marie Plain Biscuits 56.4g Light Crisp And…"       → "Parle Marie Plain Biscuits"
 *   "Milk Made Biscuits - Healthy & Delicious, Tea Time Snack" → "Milk Made Biscuits"
 *   "Jeera Dhamaal | Spiced Cumin Crunch | Anmol Industries"  → "Jeera Dhamaal"
 *
 *   cleanName(name, maxLen = 30)  cleaned, title-cased, cut at a word boundary with "…"
 */
const LEADING_SIZE = /^\s*\d+(?:\.\d+)?\s*(?:gms|gm|grams?|g|kg|ml|ltr|litre|liter|l|pcs|pc|pack)\b\.?\s*/i;
const SIZE_TAIL = /\s+\d+(?:\.\d+)?\s*(?:gms|gm|grams?|g|kg|ml|ltr|litre|liter|l|pcs|pc|pack)\b.*$/i;
const PRICE_TAIL = /\s+\d+\s*(?:rs|rupees?)\b.*$/i;
const SEO_TAIL = /\s+[-|–—]\s+.*$/;

// "CrÃ¨me" → "Crème" (UTF-8 bytes read as Latin-1 somewhere upstream)
function fixMojibake(s) {
    if (!/[ÃÂ]/.test(s) || typeof escape !== 'function') return s;
    try {
        return decodeURIComponent(escape(s));
    } catch (e) {
        return s;
    }
}

const titleWord = (w) => {
    if (/^[A-Z0-9&-]+$/.test(w) && w.length > 2 && /[A-Z]/.test(w)) return w[0] + w.slice(1).toLowerCase();
    if (/^[a-z]/.test(w) && w.length > 2) return w[0].toUpperCase() + w.slice(1);
    return w;
};

export function cleanName(raw, maxLen = 30) {
    let s = fixMojibake(String(raw || '')).replace(/\s+/g, ' ').trim();
    s = s.replace(LEADING_SIZE, '');
    s = s.replace(SEO_TAIL, '');
    s = s.replace(PRICE_TAIL, '');
    // a size after the product words ends the name ("Marie Biscuits 56.4g Light Crisp…")
    const sized = s.replace(SIZE_TAIL, '');
    if (sized.split(' ').length >= 2) s = sized;
    s = s.replace(/[\s,;:-]+$/, '').split(' ').map(titleWord).join(' ');
    if (s.length <= maxLen) return s;
    const cut = s.slice(0, maxLen - 1);
    const at = cut.lastIndexOf(' ');
    return `${(at > maxLen * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:&-]+$/, '')}…`;
}

export default cleanName;
