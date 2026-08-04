import { useSelector } from 'react-redux';
import { translations } from '../constants/translations';

export const useTranslation = () => {
    const currentLanguage = useSelector(
        (state) => state.language?.currentLanguage || state.auth?.language || 'en'
    );

    const isHi = currentLanguage === 'hi';

    const t = (key) => {
        const keys = key.split('.');
        let value = translations[currentLanguage];
        
        for (const k of keys) {
            value = value?.[k];
        }
        
        return value || key;
    };

    return { t, currentLanguage, isHi };
};
