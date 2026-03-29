/**
 * Translation Service
 * Automatically translates English text to Hindi
 * Uses Google Translate API (or can be replaced with any translation service)
 */

// Simple translation cache to avoid repeated API calls
const translationCache = new Map();

/**
 * Translate text from English to Hindi
 * @param {string} text - English text to translate
 * @returns {Promise<string>} - Translated Hindi text
 */
export const translateToHindi = async (text) => {
    if (!text) return '';
    
    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }
    
    try {
        // Using Google Translate API (free tier)
        // You can also use: Microsoft Translator, AWS Translate, or any other service
        const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=${encodeURIComponent(text)}`
        );
        
        const data = await response.json();
        
        // Extract translated text from response
        const translated = data[0]?.map(item => item[0]).join('') || text;
        
        // Cache the translation
        translationCache.set(cacheKey, translated);
        
        return translated;
    } catch (error) {
        console.error('Translation error:', error);
        // Return original text if translation fails
        return text;
    }
};

/**
 * Translate multiple texts in batch
 * @param {string[]} texts - Array of English texts
 * @returns {Promise<string[]>} - Array of translated Hindi texts
 */
export const translateBatch = async (texts) => {
    const promises = texts.map(text => translateToHindi(text));
    return Promise.all(promises);
};

/**
 * Clear translation cache (useful for memory management)
 */
export const clearTranslationCache = () => {
    translationCache.clear();
};

/**
 * Preload common translations
 * Call this on app startup to cache frequently used terms
 */
export const preloadCommonTranslations = async () => {
    const commonTerms = [
        'Bakery & Biscuits',
        'Cleaning & Essentials',
        'Tea, Coffee & Milk',
        'Personal Care',
        'Fruits & Vegetables',
        'Dairy Products',
        'Snacks',
        'Beverages',
        'Add to Cart',
        'Buy Now',
        'Out of Stock',
        'In Stock',
        'Delivery',
        'Free Delivery',
    ];
    
    await translateBatch(commonTerms);
};
