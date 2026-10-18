/**
 * Onboarding copy, English + Hindi. Short on purpose: one headline (two lines at most on a 390pt
 * phone) and one line of body per step.
 *   onboardingCopy(isHi) -> the strings for the active language
 */
const en = {
    welcome: {
        title: 'Your kirana,\ndelivered in minutes',
        body: 'Vegetables, fruit, dairy and daily staples from a store near you.',
        etaFact: (min) => `About ${min} min delivery`,
        etaFactUnknown: 'Fast local delivery',
        trackFact: 'Live rider tracking',
        payFact: 'UPI, card or cash',
        cta: 'Get started',
        haveAccount: 'Already have an account?',
        logIn: 'Log in',
    },
    fresh: {
        title: 'Packed fresh,\nthe moment you order',
        body: 'We pick from our own shelves, so what you see is what arrives.',
    },
    track: {
        title: 'Watch your order\nride to your door',
        body: 'Follow the rider live on the map, from our store to your gate.',
    },
    location: {
        title: 'Where should\nwe deliver?',
        storeLabel: 'Our store',
        homeLabel: 'Your door',
        benefitEta: 'An exact delivery time for your address',
        benefitItems: 'Only items we can deliver to you',
        reassure: 'We only use your location to show what we can deliver.',
        mapLabel: (radius) => `Map of the store and its ${radius} km delivery area`,
        useCurrent: 'Use current location',
        locating: 'Finding you…',
        manual: 'Enter address manually',
        change: 'Change location',
        tryAnother: 'Try another address',
        continue: 'Continue',
        tryAgain: 'Try again',
        browse: 'Continue browsing',
        notNow: 'Skip for now',
        currentLabel: 'Your current location',
        inArea: 'We deliver here',
        inAreaEta: (min) => `About ${min} min from our store`,
        inAreaKm: (km) => `${km} km from our store`,
        outArea: 'Not in our delivery area yet',
        outAreaBody: (radius, km) =>
            km != null
                ? `We deliver within ${radius} km of the store, and this spot is ${km} km away. You can still look around.`
                : `We deliver within ${radius} km of the store. You can still look around.`,
        deniedTitle: 'Location is off',
        deniedBody: 'No problem. Type your address instead, or turn location on later in Settings.',
        errorTitle: "We couldn't find you",
        errorBody: 'Check that location is on and try again, or type your address.',
    },
    skip: 'Skip',
    next: 'Next',
    step: (i, n) => `Step ${i} of ${n}`,
};

const hi = {
    welcome: {
        title: 'आपकी किराना,\nमिनटों में घर पर',
        body: 'पास की दुकान से सब्ज़ियाँ, फल, डेयरी और रोज़ का सामान।',
        etaFact: (min) => `लगभग ${min} मिनट में डिलीवरी`,
        etaFactUnknown: 'तेज़ लोकल डिलीवरी',
        trackFact: 'राइडर की लाइव ट्रैकिंग',
        payFact: 'UPI, कार्ड या कैश',
        cta: 'शुरू करें',
        haveAccount: 'पहले से अकाउंट है?',
        logIn: 'लॉग इन करें',
    },
    fresh: {
        title: 'ऑर्डर करते ही\nताज़ा पैकिंग',
        body: 'हम अपनी ही दुकान से सामान चुनते हैं, जो दिखता है वही पहुँचता है।',
    },
    track: {
        title: 'अपना ऑर्डर\nघर आते देखें',
        body: 'दुकान से आपके दरवाज़े तक राइडर को मैप पर लाइव देखें।',
    },
    location: {
        title: 'डिलीवरी\nकहाँ करें?',
        storeLabel: 'हमारी दुकान',
        homeLabel: 'आपका घर',
        benefitEta: 'आपके पते के लिए डिलीवरी का सही समय',
        benefitItems: 'सिर्फ़ वही सामान जो हम आप तक पहुँचा सकें',
        reassure: 'आपका स्थान सिर्फ़ यह दिखाने के लिए है कि हम क्या डिलीवर कर सकते हैं।',
        mapLabel: (radius) => `दुकान और उसके ${radius} किमी डिलीवरी क्षेत्र का मैप`,
        useCurrent: 'मौजूदा स्थान इस्तेमाल करें',
        locating: 'आपको ढूँढ रहे हैं…',
        manual: 'पता खुद लिखें',
        change: 'स्थान बदलें',
        tryAnother: 'दूसरा पता आज़माएँ',
        continue: 'आगे बढ़ें',
        tryAgain: 'फिर से कोशिश करें',
        browse: 'फिर भी देखें',
        notNow: 'अभी नहीं',
        currentLabel: 'आपका मौजूदा स्थान',
        inArea: 'हम यहाँ डिलीवर करते हैं',
        inAreaEta: (min) => `दुकान से लगभग ${min} मिनट`,
        inAreaKm: (km) => `दुकान से ${km} किमी`,
        outArea: 'यह जगह अभी डिलीवरी क्षेत्र में नहीं है',
        outAreaBody: (radius, km) =>
            km != null
                ? `हम दुकान से ${radius} किमी तक डिलीवर करते हैं, यह जगह ${km} किमी दूर है। आप फिर भी सामान देख सकते हैं।`
                : `हम दुकान से ${radius} किमी तक डिलीवर करते हैं। आप फिर भी सामान देख सकते हैं।`,
        deniedTitle: 'स्थान की अनुमति बंद है',
        deniedBody: 'कोई बात नहीं। पता खुद लिखें, या बाद में सेटिंग्स में स्थान चालू करें।',
        errorTitle: 'आपका स्थान नहीं मिला',
        errorBody: 'देखें कि स्थान चालू है और फिर से कोशिश करें, या पता खुद लिखें।',
    },
    skip: 'छोड़ें',
    next: 'आगे',
    step: (i, n) => `चरण ${i} / ${n}`,
};

export const onboardingCopy = (isHi) => (isHi ? hi : en);

export default onboardingCopy;
