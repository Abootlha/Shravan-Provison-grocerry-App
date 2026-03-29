import { useState, useEffect } from 'react';
import { translateToHindi } from '../services/translationService';
import { useTranslation } from './useTranslation';

/**
 * Hook to get localized text with automatic translation
 * Handles state updates when translation completes
 */
export const useLocalizedText = (text, type = 'name') => {
    const { currentLanguage } = useTranslation();
    const [localizedText, setLocalizedText] = useState(text);

    useEffect(() => {
        const translateText = async () => {
            // If English or no text, return original
            if (currentLanguage === 'en' || !text) {
                setLocalizedText(text);
                return;
            }

            // If Hindi, translate
            if (currentLanguage === 'hi') {
                try {
                    const translated = await translateToHindi(text);
                    setLocalizedText(translated);
                } catch (error) {
                    console.error('Translation error:', error);
                    setLocalizedText(text); // Fallback to original
                }
            }
        };

        translateText();
    }, [text, currentLanguage]);

    return localizedText;
};

/**
 * Hook to get localized item (product/category) with all fields translated
 */
export const useLocalizedItem = (item) => {
    const { currentLanguage } = useTranslation();
    const [localizedItem, setLocalizedItem] = useState(item);

    useEffect(() => {
        const translateItem = async () => {
            if (!item || currentLanguage === 'en') {
                setLocalizedItem(item);
                return;
            }

            if (currentLanguage === 'hi') {
                try {
                    const translated = { ...item };

                    // Translate name
                    if (item.name) {
                        translated.name = item.nameHi || await translateToHindi(item.name);
                    }

                    // Translate description
                    if (item.description) {
                        translated.description = item.descriptionHi || await translateToHindi(item.description);
                    }

                    // Translate brand
                    if (item.brand) {
                        translated.brand = item.brandHi || await translateToHindi(item.brand);
                    }

                    setLocalizedItem(translated);
                } catch (error) {
                    console.error('Translation error:', error);
                    setLocalizedItem(item);
                }
            }
        };

        translateItem();
    }, [item, currentLanguage]);

    return localizedItem;
};
