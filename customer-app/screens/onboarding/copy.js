/**
 * Onboarding copy, English + Hindi. Two-line headlines (the "\n" is the intended break), one line of
 * body. Numbers (delivery time, radius, distance) always come from the store settings or the user's
 * point — never typed in here.
 *   onboardingCopy(isHi) -> the strings for the active language
 */
const en = {
    welcome: {
        title: (min) => (min ? `Groceries in\n${min} minutes.` : 'Groceries,\ndelivered fast.'),
        // `kinds`: what the live catalogue actually stocks (stockKinds), most-stocked first
        body: (kinds) => {
            const k = kinds.slice(0, 2).map((x) => x.en);
            const line = k.length ? `${k.join(', ')} and daily staples` : 'Daily staples';
            return `${line[0].toUpperCase()}${line.slice(1)} from Shravan Kirana.`;
        },
        facts: 'UPI, card or cash  ·  Live rider tracking',
        cta: 'Get started',
        haveAccount: 'Already have an account?',
        logIn: 'Log in',
    },
    pack: {
        title: 'Packed as\nyou order.',
        body: 'Picked from our own shelves, checked, and bagged for the rider.',
    },
    track: {
        title: 'Track it to\nyour door.',
        body: 'Follow your rider live on the map, from our store to your gate.',
        mapLabel: 'Map: a rider on the way from the store to a home',
    },
    location: {
        title: 'Where should\nwe deliver?',
        body: 'We show the exact delivery time and only what we can bring you.',
        useCurrent: 'Use my current location',
        manual: 'Enter address',
        change: 'Change address',
        tryAnother: 'Try another address',
        continue: 'Continue',
        tryAgain: 'Try again',
        browse: 'Continue browsing',
        notNow: 'Skip for now',
        reassure: 'Your location is used only to check delivery.',
        currentLabel: 'Your current location',
        inAreaTitle: 'We deliver\nhere.',
        inAreaLine: (min, where) => [min ? `~${min} min` : null, where].filter(Boolean).join('  ·  '),
        outAreaTitle: 'Not in our\narea yet.',
        outAreaBody: (radius, km) =>
            km != null
                ? `We deliver within ${radius} km of the store; this spot is ${km} km away. You can still look around.`
                : `We deliver within ${radius} km of the store. You can still look around.`,
        deniedTitle: 'Location\nis off.',
        deniedBody: 'No problem. Type your address instead, or turn location on later in Settings.',
        errorTitle: "We couldn't\nfind you.",
        errorBody: 'Check that location is on and try again, or type your address.',
        mapLabel: (radius) => `Map of the store and its ${radius} km delivery area`,
    },
    skip: 'Skip',
    next: 'Next',
    back: 'Back',
    step: (i, n) => `Step ${i} of ${n}`,
};

const hi = {
    welcome: {
        title: (min) => (min ? `${min} मिनट में\nराशन घर पर।` : 'राशन,\nझटपट घर पर।'),
        body: (kinds) => {
            const k = kinds.slice(0, 2).map((x) => x.hi);
            return k.length ? `${k.join(', ')} और रोज़ का सामान, श्रवण किराना से।` : 'रोज़ का सामान, श्रवण किराना से।';
        },
        facts: 'UPI, कार्ड या कैश  ·  राइडर की लाइव ट्रैकिंग',
        cta: 'शुरू करें',
        haveAccount: 'पहले से अकाउंट है?',
        logIn: 'लॉग इन करें',
    },
    pack: {
        title: 'ऑर्डर करते ही\nपैकिंग शुरू।',
        body: 'हमारी अपनी दुकान से चुना, जाँचा और राइडर के लिए पैक किया।',
    },
    track: {
        title: 'दरवाज़े तक\nलाइव ट्रैक करें।',
        body: 'दुकान से आपके दरवाज़े तक राइडर को मैप पर लाइव देखें।',
        mapLabel: 'मैप: दुकान से घर की ओर जाता राइडर',
    },
    location: {
        title: 'डिलीवरी\nकहाँ करें?',
        body: 'हम डिलीवरी का सही समय और सिर्फ़ वही सामान दिखाएँगे जो हम ला सकें।',
        useCurrent: 'मेरा मौजूदा स्थान इस्तेमाल करें',
        manual: 'पता लिखें',
        change: 'पता बदलें',
        tryAnother: 'दूसरा पता आज़माएँ',
        continue: 'आगे बढ़ें',
        tryAgain: 'फिर से कोशिश करें',
        browse: 'फिर भी देखें',
        notNow: 'अभी नहीं',
        reassure: 'आपका स्थान सिर्फ़ डिलीवरी जाँचने के लिए लिया जाता है।',
        currentLabel: 'आपका मौजूदा स्थान',
        inAreaTitle: 'हम यहाँ\nडिलीवर करते हैं।',
        inAreaLine: (min, where) => [min ? `~${min} मिनट` : null, where].filter(Boolean).join('  ·  '),
        outAreaTitle: 'यह जगह अभी\nक्षेत्र में नहीं।',
        outAreaBody: (radius, km) =>
            km != null
                ? `हम दुकान से ${radius} किमी तक डिलीवर करते हैं; यह जगह ${km} किमी दूर है। आप फिर भी सामान देख सकते हैं।`
                : `हम दुकान से ${radius} किमी तक डिलीवर करते हैं। आप फिर भी सामान देख सकते हैं।`,
        deniedTitle: 'स्थान की अनुमति\nबंद है।',
        deniedBody: 'कोई बात नहीं। पता खुद लिखें, या बाद में सेटिंग्स में स्थान चालू करें।',
        errorTitle: 'आपका स्थान\nनहीं मिला।',
        errorBody: 'देखें कि स्थान चालू है और फिर से कोशिश करें, या पता खुद लिखें।',
        mapLabel: (radius) => `दुकान और उसके ${radius} किमी डिलीवरी क्षेत्र का मैप`,
    },
    skip: 'छोड़ें',
    next: 'आगे',
    back: 'पीछे',
    step: (i, n) => `चरण ${i} / ${n}`,
};

// Kinds of things a kirana stocks, matched against subcategory (preferred) or category names.
const KINDS = [
    [/fruit|vegetable|\bveg\b|produce|sabzi/i, 'fresh produce', 'ताज़ी सब्ज़ियाँ'],
    [/tea|coffee/i, 'tea and coffee', 'चाय-कॉफ़ी'],
    [/dairy|milk|paneer|curd|dahi|butter|cheese/i, 'dairy', 'डेयरी'],
    [/ghee/i, 'ghee', 'घी'],
    [/biscuit|cookie|bakery|rusk/i, 'biscuits', 'बिस्कुट'],
    [/atta|flour|rice|\bdaa?l\b|pulse/i, 'atta and rice', 'आटा-चावल'],
    [/spice|masala/i, 'spices', 'मसाले'],
    [/\boils?\b/i, 'cooking oil', 'तेल'],
    [/chips|namkeen|snack/i, 'snacks', 'नमकीन'],
    [/instant|frozen|noodle/i, 'instant food', 'इंस्टेंट फ़ूड'],
    [/clean|detergent|laundry/i, 'cleaning essentials', 'सफ़ाई का सामान'],
    [/personal|soap|shampoo|tooth/i, 'personal care', 'पर्सनल केयर'],
];
const nameOf = (v) => (v && typeof v === 'object' ? v.name : '') || '';

/** What the catalogue actually stocks, most-stocked first: [{ en, hi, count }]. Empty when unknown. */
export function stockKinds(products) {
    const counts = new Map();
    (products || []).forEach((p) => {
        const label = nameOf(p.subcategoryId) || nameOf(p.subcategory) || nameOf(p.categoryId) || nameOf(p.category);
        const hit = KINDS.find(([re]) => re.test(label)) || KINDS.find(([re]) => re.test(nameOf(p.categoryId)));
        if (!hit) return;
        const cur = counts.get(hit[1]) || { en: hit[1], hi: hit[2], count: 0 };
        cur.count += 1;
        counts.set(hit[1], cur);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count);
}

export const onboardingCopy = (isHi) => (isHi ? hi : en);

export default onboardingCopy;
