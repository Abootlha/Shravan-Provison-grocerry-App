import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { translations } from '../constants/translations';

export const useTranslation = () => {
    const currentLanguage = useSelector(
        (state) => state.language?.currentLanguage || state.auth?.language || 'en'
    );

    const isHi = currentLanguage === 'hi';

    // Stable per language: `t` sits in many useCallback/useMemo deps (list renderItems),
    // so a fresh function every render would re-render whole lists on unrelated updates.
    const t = useCallback((key) => {
        const keys = key.split('.');
        let value = translations[currentLanguage];

        for (const k of keys) {
            value = value?.[k];
        }

        return value || key;
    }, [currentLanguage]);

    return useMemo(() => ({ t, currentLanguage, isHi }), [t, currentLanguage, isHi]);
};
