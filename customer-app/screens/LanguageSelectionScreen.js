/**
 * LanguageSelectionScreen — flat auth canvas: AuthBar logo, a plain "Choose your language" headline
 * (crossfades into the picked language), two selectable language cards (surface + hairline; selected =
 * violet border + brand tint, spring check) and a Continue button pinned above the bottom safe area.
 * No gradient hero, no mascot, no sticker (DESIGN.md "Auth/onboarding").
 * Opened from Profile (`params.fromSettings`) it saves and goes back instead of onboarding.
 * Theme: canvas + surface cards in both modes.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setLanguage } from '../store/slices/languageSlice';
import { radii, space } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { springs, durations, easings } from '../theme/motion';
import { Button, ContentSwap, PressableScale, Screen, Text, useStaggeredEntrance } from '../components/ui';
import { AuthBar, AuthHeading } from './auth/AuthHero';

const LANGUAGES = [
    { code: 'en', glyph: 'Aa', name: 'English', hint: 'Continue in English' },
    { code: 'hi', glyph: 'अ', name: 'हिंदी', hint: 'हिंदी में जारी रखें' },
];

function LanguageCard({ lang, selected, onPress, index }) {
    const styles = useStyles();
    const { colors } = useTheme();
    const reduce = useReducedMotion();
    const on = useSharedValue(selected ? 1 : 0);
    const check = useSharedValue(selected ? 1 : 0);
    const enter = useStaggeredEntrance(index + 1, { delay: 70 });

    useEffect(() => {
        on.value = withTiming(selected ? 1 : 0, { duration: durations.fast, easing: easings.out });
        check.value = reduce ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, springs.bouncy);
    }, [selected, reduce, on, check]);

    const cardStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(on.value, [0, 1], [colors.hairline, colors.accent]),
        backgroundColor: interpolateColor(on.value, [0, 1], [colors.surface, colors.brandTint]),
    }));
    const checkStyle = useAnimatedStyle(() => ({
        opacity: Math.min(1, check.value),
        transform: [{ scale: 0.6 + check.value * 0.4 }],
    }));
    const ringStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, check.value) }));

    return (
        <Animated.View style={enter}>
            <PressableScale
                onPress={onPress}
                haptic="selection"
                scaleTo={0.98}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={lang.name}
            >
                <Animated.View style={[styles.card, cardStyle]}>
                    <View style={styles.glyph}>
                        <Text variant="h2" color="ink">{lang.glyph}</Text>
                    </View>
                    <View style={styles.cardText}>
                        <Text variant="h3">{lang.name}</Text>
                        <Text variant="caption" color="muted">{lang.hint}</Text>
                    </View>
                    <View style={styles.checkBox}>
                        <Animated.View style={[styles.ring, ringStyle]} />
                        <Animated.View style={[styles.check, checkStyle]}>
                            <MaterialCommunityIcons name="check" size={18} color={colors.onAccent} />
                        </Animated.View>
                    </View>
                </Animated.View>
            </PressableScale>
        </Animated.View>
    );
}

const LanguageSelectionScreen = ({ navigation, route }) => {
    const styles = useStyles();
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const fromSettings = Boolean(route?.params?.fromSettings);
    const current = useSelector((state) => state.language?.currentLanguage);
    const [selectedLanguage, setSelectedLanguage] = useState(fromSettings && current ? current : 'en');
    const isHi = selectedLanguage === 'hi';
    const headEnter = useStaggeredEntrance(0, { delay: 70 });

    const handleContinue = () => {
        dispatch(setLanguage(selectedLanguage));
        if (fromSettings && navigation.canGoBack()) {
            navigation.goBack();
            return;
        }
        navigation.replace('Onboarding');
    };

    return (
        <Screen edges={[]} background="canvas">
            <AuthBar
                onBack={fromSettings && navigation.canGoBack() ? () => navigation.goBack() : undefined}
                backLabel={isHi ? 'वापस जाएँ' : 'Go back'}
            />
            <View style={styles.body}>
                <Animated.View style={headEnter}>
                    <ContentSwap stateKey={selectedLanguage}>
                        <AuthHeading
                            title={isHi ? 'अपनी भाषा चुनें' : 'Choose your language'}
                            subtitle={isHi ? 'आप इसे बाद में प्रोफ़ाइल में बदल सकते हैं' : 'You can change this later in your profile'}
                        />
                    </ContentSwap>
                </Animated.View>

                <View style={styles.list} accessibilityRole="radiogroup">
                    {LANGUAGES.map((lang, i) => (
                        <LanguageCard
                            key={lang.code}
                            lang={lang}
                            index={i}
                            selected={selectedLanguage === lang.code}
                            onPress={() => setSelectedLanguage(lang.code)}
                        />
                    ))}
                </View>
            </View>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
                <Button size="lg" fullWidth label={isHi ? 'जारी रखें' : 'Continue'} onPress={handleContinue} />
            </View>
        </Screen>
    );
};

const useStyles = makeStyles((t) => ({
    body: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xl, gap: space['2xl'] },
    list: { gap: space.md },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.lg,
        minHeight: 80,
        padding: space.lg,
        borderRadius: radii.card,
        borderWidth: 1.5,
    },
    glyph: { width: 48, height: 48, borderRadius: radii.pill, backgroundColor: t.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
    cardText: { flex: 1, gap: space.xxs },
    checkBox: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    ring: { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: t.colors.borderStrong },
    check: { width: 28, height: 28, borderRadius: 14, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' },
    footer: { paddingHorizontal: space.lg, paddingTop: space.md },
}));

export default LanguageSelectionScreen;
