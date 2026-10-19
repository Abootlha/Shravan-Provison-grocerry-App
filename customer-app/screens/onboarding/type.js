/**
 * Onboarding type scale (44 / 17 / 15 / 13) and the Devanagari face for Hindi.
 *
 *   const T = useOnboardingType(isHi);
 *   <Text style={T.display}>…</Text>   44/46 Bricolage 700, tight (Hindi: Noto Sans Devanagari 700, 34/48)
 *   T.lead     17/24 Jakarta 600       (Hindi: Noto 600)
 *   T.body     15/22 Jakarta 400       (Hindi: Noto 400, 15/24)
 *   T.meta     13/18 Jakarta 500       (Hindi: Noto 500)
 *   T.strong   13/18 Jakarta 700       (Hindi: Noto 700)
 *   T.button   labelStyle for components/ui Button: Noto 600 in Hindi, undefined otherwise
 *
 * Latin faces are loaded by App.js. Noto Sans Devanagari (@expo-google-fonts/noto-sans-devanagari) is
 * loaded here the first time onboarding renders; until it arrives (or if it fails) Hindi falls back to the
 * system Devanagari face with the same sizes, so nothing waits on it. Pass these as the `style` of
 * components/ui <Text> — the style wins over the variant's face.
 */
import { useMemo } from 'react';
import { useFonts } from 'expo-font';
import {
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_500Medium,
    NotoSansDevanagari_600SemiBold,
    NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';
import { displayFamily, fontFamily } from '../../constants/theme';

export function useOnboardingType(isHi) {
    const [loaded] = useFonts({
        NotoSansDevanagari_400Regular,
        NotoSansDevanagari_500Medium,
        NotoSansDevanagari_600SemiBold,
        NotoSansDevanagari_700Bold,
    });
    return useMemo(() => {
        const hi = isHi && loaded;
        const face = (latin, deva) => ({ fontFamily: hi ? deva : latin });
        return {
            display: isHi
                ? { ...face(displayFamily.bold, 'NotoSansDevanagari_700Bold'), fontSize: 34, lineHeight: 48, letterSpacing: 0 }
                : { ...face(displayFamily.bold, displayFamily.bold), fontSize: 44, lineHeight: 46, letterSpacing: -1.6 },
            lead: { ...face(fontFamily.semibold, 'NotoSansDevanagari_600SemiBold'), fontSize: 17, lineHeight: 24 },
            body: { ...face(fontFamily.regular, 'NotoSansDevanagari_400Regular'), fontSize: 15, lineHeight: isHi ? 24 : 22 },
            meta: { ...face(fontFamily.medium, 'NotoSansDevanagari_500Medium'), fontSize: 13, lineHeight: isHi ? 20 : 18 },
            strong: { ...face(fontFamily.bold, 'NotoSansDevanagari_700Bold'), fontSize: 13, lineHeight: isHi ? 20 : 18 },
            // Button labelStyle: only Hindi changes the face; English buttons stay exactly as they are
            button: hi ? { fontFamily: 'NotoSansDevanagari_600SemiBold', lineHeight: 24 } : undefined,
        };
    }, [isHi, loaded]);
}

export default useOnboardingType;
