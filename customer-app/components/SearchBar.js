/**
 * SearchBar — the 48pt search field (Part C #2): input radius 10, sunken fill (dark: raised) with a
 * hairline, flat (no shadow — it sits inside the header).
 *
 * Read-only (default): a PressableScale that opens the Search screen, with a rotating
 * "Search for 'milk'" hint. Interactive (`editable` or `onChangeText`): a real TextInput.
 *
 * Search morph: in read-only mode `onPress(fromRect)` receives the pill's window rect
 * `{ x, y, width, height }` (measured at tap time), so the caller can pass it to the Search screen
 * (`navigation.navigate('Search', { fromRect })`) and Search grows its field out of this bar.
 *
 * Props
 *   onPress        open search (read-only mode, also fired by the mic) — called with `fromRect`
 *   onChangeText / value / placeholder / editable / autoFocus   interactive mode
 *   showVoice      mic affordance on the right (default true)
 *   showCamera     camera affordance (default false)
 *   suggestions    words cycled in the hint (default: staples)
 *   style
 */
import React, { memo, useCallback, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale, RotatingPlaceholder, Text } from './ui';
import { radii, space, type, HIT } from '../constants/theme';
import { makeStyles, useTheme } from '../theme';
import { press } from '../theme/motion';
import { useTranslation } from '../hooks/useTranslation';

const DEFAULT_SUGGESTIONS = ['milk', 'atta', 'chips', 'paneer', 'bread', 'eggs', 'cold drinks', 'tomato'];
const DEFAULT_SUGGESTIONS_HI = ['दूध', 'आटा', 'चिप्स', 'पनीर', 'ब्रेड', 'अंडे', 'कोल्ड ड्रिंक', 'टमाटर'];

const SearchBar = ({
    onPress,
    onChangeText,
    value,
    placeholder,
    editable = false,
    autoFocus = false,
    showVoice = true,
    showCamera = false,
    suggestions,
    style,
}) => {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const { t, isHi } = useTranslation();
    const [focused, setFocused] = useState(false);
    const pillRef = useRef(null);

    // Measure the pill at tap time and hand its window rect to onPress (the Search morph origin).
    // measureInWindow is cheap and reports post-transform coordinates (Home's header may be mid-collapse).
    const pressWithRect = useCallback(() => {
        if (!onPress) return;
        const node = pillRef.current;
        if (!node || typeof node.measureInWindow !== 'function') {
            onPress();
            return;
        }
        let done = false;
        const go = (rect) => {
            if (done) return;
            done = true;
            onPress(rect);
        };
        // never let a missing callback hold up navigation
        const guard = setTimeout(() => go(undefined), 100);
        node.measureInWindow((x, y, width, height) => {
            clearTimeout(guard);
            go(width > 0 && height > 0 ? { x, y, width, height } : undefined);
        });
    }, [onPress]);
    const isInteractive = editable || !!onChangeText;
    const words = suggestions || (isHi ? DEFAULT_SUGGESTIONS_HI : DEFAULT_SUGGESTIONS);
    const prefix = isHi ? 'खोजें ' : 'Search for ';

    const trailing = (
        <View style={styles.trailing}>
            {showVoice ? (
                <>
                    <View style={styles.divider} />
                    <PressableScale
                        onPress={isInteractive ? onPress : pressWithRect}
                        haptic="light"
                        scaleTo={press.deep}
                        accessibilityLabel={isHi ? 'आवाज़ से खोजें' : 'Search by voice'}
                        style={styles.iconHit}
                    >
                        <MaterialCommunityIcons name="microphone-outline" size={20} color={colors.inkSecondary} />
                    </PressableScale>
                </>
            ) : null}
            {showCamera ? (
                <PressableScale
                    onPress={isInteractive ? onPress : pressWithRect}
                    haptic="light"
                    scaleTo={press.deep}
                    accessibilityLabel={isHi ? 'फ़ोटो से खोजें' : 'Search by photo'}
                    style={styles.iconHit}
                >
                    <MaterialCommunityIcons name="camera-outline" size={20} color={colors.inkSecondary} />
                </PressableScale>
            ) : null}
        </View>
    );

    if (isInteractive) {
        return (
            <View style={[styles.pill, style]}>
                <MaterialCommunityIcons name="magnify" size={22} color={colors.ink} style={styles.lead} />
                <View style={styles.field}>
                    <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={onChangeText}
                        autoFocus={autoFocus}
                        returnKeyType="search"
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        placeholder={placeholder}
                        placeholderTextColor={colors.inkMuted}
                        selectionColor={colors.brand}
                        cursorColor={colors.brandText}
                        keyboardAppearance={isDark ? 'dark' : 'light'}
                        accessibilityLabel={placeholder || t('searchPlaceholder')}
                    />
                    {!value && !placeholder ? (
                        <RotatingPlaceholder items={words} prefix={prefix} paused={focused} style={[styles.overlay, { pointerEvents: 'none' }]} />
                    ) : null}
                </View>
                {trailing}
            </View>
        );
    }

    // The pill is a View with two sibling pressables (field + mic) so buttons never nest.
    return (
        <View ref={pillRef} collapsable={false} style={[styles.pill, style]}>
            <PressableScale
                onPress={pressWithRect}
                scaleTo={press.subtle}
                accessibilityLabel={t('searchPlaceholder')}
                style={styles.fieldPress}
            >
                <MaterialCommunityIcons name="magnify" size={22} color={colors.brandText} style={styles.lead} />
                <View style={[styles.field, { pointerEvents: 'none' }]}>
                    {placeholder ? (
                        <Text variant="body" color="muted" numberOfLines={1}>
                            {placeholder}
                        </Text>
                    ) : (
                        <RotatingPlaceholder items={words} prefix={prefix} />
                    )}
                </View>
            </PressableScale>
            {trailing}
        </View>
    );
};

const useStyles = makeStyles((t) => ({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        borderRadius: radii.input,
        // light: the sunken fill on the white header; dark: the raised layer + a slightly stronger line
        backgroundColor: t.isDark ? t.colors.surfaceRaised : t.colors.surfaceSunken,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.isDark ? t.colors.border : t.colors.hairline,
        paddingLeft: space.md,
    },
    fieldPress: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
    lead: { marginRight: space.sm },
    field: { flex: 1, justifyContent: 'center', minHeight: 48 },
    input: {
        ...type.body,
        color: t.colors.ink,
        minHeight: 48,
        paddingVertical: 0,
        outlineStyle: 'none',
    },
    overlay: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
    trailing: { flexDirection: 'row', alignItems: 'center', paddingRight: space.xs },
    divider: { width: StyleSheet.hairlineWidth * 2, height: 20, backgroundColor: t.isDark ? t.colors.border : t.colors.hairline, marginLeft: space.xs },
    iconHit: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
}));

export default memo(SearchBar);
