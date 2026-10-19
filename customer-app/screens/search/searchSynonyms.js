/**
 * Search language help: Hindi / Hinglish synonyms and small-typo correction, all client side.
 *
 *   expandQuery(query, vocabulary) → {
 *     text        what we search for (canonical English words + the original words, space separated:
 *                 GET /products?search= matches any word, so "doodh" also finds "milk")
 *     corrected   the readable correction to show ("milk"), or null when nothing was changed
 *     original    the query as typed
 *   }
 *
 * The backend applies the same synonym table (backend/src/modules/products/search-synonyms.ts), so
 * other clients get it too; keep the two lists in step.
 *
 * Typo tolerance: a word that matches nothing in the vocabulary (words from real product, category
 * and subcategory names, plus the synonym keys) is replaced by the closest vocabulary word within
 * edit distance 1 (words of 4–5 letters) or 2 (6+ letters). Shorter words are never "corrected".
 */

/** Hinglish / Devanagari → the English word the catalogue uses. */
export const SYNONYMS = {
    // dairy
    doodh: 'milk', dudh: 'milk', 'दूध': 'milk',
    dahi: 'curd', 'दही': 'curd', curd: 'dahi',
    makhan: 'butter', makkhan: 'butter', 'मक्खन': 'butter',
    paneer: 'paneer', panir: 'paneer', 'पनीर': 'paneer',
    ghee: 'ghee', ghi: 'ghee', 'घी': 'ghee',
    anda: 'eggs', ande: 'eggs', 'अंडा': 'eggs', 'अंडे': 'eggs', egg: 'eggs',
    // staples
    atta: 'atta', aata: 'atta', ata: 'atta', 'आटा': 'atta', flour: 'atta',
    chawal: 'rice', chaawal: 'rice', 'चावल': 'rice',
    dal: 'dal', daal: 'dal', 'दाल': 'dal',
    namak: 'salt', 'नमक': 'salt',
    cheeni: 'sugar', chini: 'sugar', shakkar: 'sugar', 'चीनी': 'sugar',
    tel: 'oil', 'तेल': 'oil',
    besan: 'besan', 'बेसन': 'besan',
    masala: 'masala', 'मसाला': 'masala', mirch: 'mirch', 'मिर्च': 'chilli',
    // produce
    sabzi: 'vegetables', sabji: 'vegetables', subzi: 'vegetables', 'सब्ज़ी': 'vegetables', 'सब्जी': 'vegetables',
    aloo: 'potato', alu: 'potato', 'आलू': 'potato',
    pyaaz: 'onion', pyaz: 'onion', pyaj: 'onion', 'प्याज़': 'onion', 'प्याज': 'onion',
    tamatar: 'tomato', 'टमाटर': 'tomato',
    bhindi: 'bhindi', 'भिंडी': 'bhindi', okra: 'bhindi',
    dhaniya: 'coriander', dhania: 'coriander', 'धनिया': 'coriander',
    kela: 'banana', 'केला': 'banana',
    seb: 'apple', 'सेब': 'apple',
    aam: 'mango', 'आम': 'mango',
    phal: 'fruits', 'फल': 'fruits',
    // packaged
    biskut: 'biscuits', biscuit: 'biscuits', biskit: 'biscuits', 'बिस्कुट': 'biscuits',
    chai: 'tea', 'चाय': 'tea', patti: 'tea',
    kofi: 'coffee', 'कॉफ़ी': 'coffee', 'कॉफी': 'coffee',
    namkeen: 'namkeen', 'नमकीन': 'namkeen', bhujia: 'bhujia',
    chips: 'chips', 'चिप्स': 'chips',
    noodle: 'noodles', 'नूडल्स': 'noodles',
    roti: 'atta', double: 'bread', 'ब्रेड': 'bread', pav: 'bread',
    sabun: 'soap', 'साबुन': 'soap', soap: 'bathing',
    manjan: 'toothpaste', 'मंजन': 'toothpaste',
    juice: 'juice', 'जूस': 'juice', sharbat: 'juice',
};

/** Phrases checked before single words. */
const PHRASES = {
    'hari mirch': 'green chilli',
    'हरी मिर्च': 'green chilli',
    'lal mirch': 'mirch',
    'cold drink': 'soft drink',
    'thanda': 'soft drink',
    'double roti': 'bread',
    'sarson tel': 'mustard oil',
    'sarson ka tel': 'mustard oil',
};

export const normalizeText = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Damerau-Levenshtein (optimal string alignment), stops early past `max`. */
export function editDistance(a, b, max = 2) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const prev2 = new Array(b.length + 1);
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i += 1) {
        const cur = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
            cur[j] = v;
            if (v < rowMin) rowMin = v;
        }
        if (rowMin > max) return max + 1;
        for (let j = 0; j <= b.length; j += 1) prev2[j] = prev[j];
        prev = cur;
    }
    return prev[b.length];
}

/** Lowercased words (≥3 letters) from the names the catalogue actually uses. */
export function buildVocabulary(names = []) {
    const words = new Set();
    names.forEach((n) => normalizeText(n).split(' ').forEach((w) => w.length >= 3 && words.add(w)));
    return words;
}

const allowedDistance = (w) => (w.length >= 6 ? 2 : w.length >= 4 ? 1 : 0);

function closest(word, vocabulary) {
    const max = allowedDistance(word);
    if (!max) return null;
    let best = null;
    let bestD = max + 1;
    const consider = (cand) => {
        const d = editDistance(word, cand, max);
        if (d < bestD || (d === bestD && best && cand.length < best.length)) {
            best = cand;
            bestD = d;
        }
    };
    vocabulary.forEach(consider);
    Object.keys(SYNONYMS).forEach((k) => !/[^\x00-\x7F]/.test(k) && consider(k));
    return bestD <= max ? best : null;
}

const known = (word, vocabulary) => vocabulary.has(word) || SYNONYMS[word] != null || [...vocabulary].some((v) => v.startsWith(word));

export function expandQuery(query, vocabulary = new Set()) {
    const original = String(query || '').trim();
    const norm = normalizeText(original);
    if (!norm) return { text: '', corrected: null, original };

    let rest = norm;
    const shown = [];
    const extra = [];
    let changed = false;
    Object.entries(PHRASES).forEach(([phrase, canon]) => {
        if (rest.includes(phrase)) {
            rest = rest.replace(phrase, ' ');
            shown.push(canon);
            extra.push(canon);
            changed = true;
        }
    });
    rest
        .split(' ')
        .filter(Boolean)
        .forEach((word) => {
            const syn = SYNONYMS[word];
            if (syn) {
                shown.push(syn);
                if (syn !== word) {
                    extra.push(syn);
                    // a translation is a correction worth showing; "paneer" → "paneer" is not
                    if (!vocabulary.has(word)) changed = true;
                }
                extra.push(word);
                return;
            }
            if (known(word, vocabulary)) {
                shown.push(word);
                extra.push(word);
                return;
            }
            const fix = closest(word, vocabulary);
            if (fix) {
                const canon = SYNONYMS[fix] || fix;
                shown.push(canon);
                extra.push(canon);
                changed = true;
            } else {
                shown.push(word);
                extra.push(word);
            }
        });
    const text = [...new Set(extra)].join(' ');
    return { text, corrected: changed ? shown.join(' ') : null, original };
}

export default expandQuery;
