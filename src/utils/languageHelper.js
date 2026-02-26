import { translateToHindi } from '../services/translationService';

// Cache for translated names to avoid repeated translations
const translatedCache = new Map();

/**
 * Helper function to get localized name from backend data
 * Automatically translates to Hindi if language is 'hi'
 * @param {Object} item - Item with name field
 * @param {string} language - Current language ('en' or 'hi')
 * @returns {Promise<string>|string} - Localized name
 */
export const getLocalizedName = async (item, language) => {
    if (!item || !item.name) return '';
    
    // If English or no translation needed, return original
    if (language === 'en') {
        return item.name;
    }
    
    // If Hindi name is manually provided in backend, use it
    if (language === 'hi' && item.nameHi) {
        return item.nameHi;
    }
    
    // Auto-translate to Hindi
    if (language === 'hi') {
        const cacheKey = `name_${item.name}`;
        
        // Check cache
        if (translatedCache.has(cacheKey)) {
            return translatedCache.get(cacheKey);
        }
        
        // Translate and cache
        const translated = await translateToHindi(item.name);
        translatedCache.set(cacheKey, translated);
        return translated;
    }
    
    return item.name;
};

/**
 * Synchronous version - returns original name immediately, translates in background
 * Use this for list rendering to avoid async issues
 */
export const getLocalizedNameSync = (item, language) => {
    if (!item || !item.name) return '';
    
    if (language === 'en') return item.name;
    if (language === 'hi' && item.nameHi) return item.nameHi;
    
    const cacheKey = `name_${item.name}`;
    
    // Return cached translation if available
    if (translatedCache.has(cacheKey)) {
        return translatedCache.get(cacheKey);
    }
    
    // Translate in background
    translateToHindi(item.name).then(translated => {
        translatedCache.set(cacheKey, translated);
    });
    
    // Return original name while translation is in progress
    return item.name;
};

/**
 * Helper function to get localized description from backend data
 * @param {Object} item - Item with description field
 * @param {string} language - Current language ('en' or 'hi')
 * @returns {Promise<string>|string} - Localized description
 */
export const getLocalizedDescription = async (item, language) => {
    if (!item || !item.description) return '';
    
    if (language === 'en') return item.description;
    if (language === 'hi' && item.descriptionHi) return item.descriptionHi;
    
    if (language === 'hi') {
        const cacheKey = `desc_${item.description}`;
        
        if (translatedCache.has(cacheKey)) {
            return translatedCache.get(cacheKey);
        }
        
        const translated = await translateToHindi(item.description);
        translatedCache.set(cacheKey, translated);
        return translated;
    }
    
    return item.description;
};

/**
 * Helper function to get localized brand from backend data
 * @param {Object} item - Item with brand field
 * @param {string} language - Current language ('en' or 'hi')
 * @returns {Promise<string>|string} - Localized brand
 */
export const getLocalizedBrand = async (item, language) => {
    if (!item || !item.brand) return '';
    
    if (language === 'en') return item.brand;
    if (language === 'hi' && item.brandHi) return item.brandHi;
    
    if (language === 'hi') {
        const cacheKey = `brand_${item.brand}`;
        
        if (translatedCache.has(cacheKey)) {
            return translatedCache.get(cacheKey);
        }
        
        const translated = await translateToHindi(item.brand);
        translatedCache.set(cacheKey, translated);
        return translated;
    }
    
    return item.brand;
};

/**
 * Clear translation cache
 */
export const clearLocalizedCache = () => {
    translatedCache.clear();
};
