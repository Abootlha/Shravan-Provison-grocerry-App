/**
 * Search header: back button + autofocused 48px field (r14, hairline) on the canvas wash, with a
 * rotating placeholder and clear.
 *
 * Shared position with Home (motion spec · Search): Home passes the window rect of its own search
 * bar as `fromRect` {x, y, width, height}. When it arrives, the field measures its final rect and
 * springs from Home's bar into place. The field's SURFACE (fill, hairline, shadow) translates and
 * scales between the two rects; its CONTENT (icon, text) only translates, so glyphs never stretch.
 * The back button fades in once the bar has mostly landed. Reduced motion: a plain fade.
 * A new `fromRect` (a later tap on Home's bar) replays it; the dock's Search tab, which passes no
 * rect, doesn't animate.
 */
import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { IconButton, RotatingPlaceholder } from '../../components/ui';
import { radii, space, type } from '../../constants/theme';
import { useTheme, makeStyles } from '../../theme';
import { springs, durations, easings } from '../../theme/motion';

const SUGGESTIONS_EN = ['milk', 'atta', 'eggs', 'bread', 'chips', 'paneer'];
const SUGGESTIONS_HI = ['दूध', 'आटा', 'अंडे', 'ब्रेड', 'चिप्स', 'पनीर'];

const validRect = (r) => !!r && [r.x, r.y, r.width, r.height].every((n) => Number.isFinite(n)) && r.width > 0 && r.height > 0;

/** Animates the field from `fromRect` (window coords) to wherever it lays out. */
function useFromRect(fromRect, fieldRef) {
    const reduce = useReducedMotion();
    const p = useSharedValue(0); // 1 = sitting on Home's bar, 0 = home position
    const shown = useSharedValue(validRect(fromRect) ? 0 : 1); // hidden until measured
    const geo = useSharedValue({ dx: 0, dy: 0, sx: 1, sy: 1, cdx: 0 });
    const played = useRef(null);

    const play = useCallback(() => {
        if (!validRect(fromRect) || played.current === fromRect) return;
        const node = fieldRef.current;
        if (!node?.measureInWindow) {
            shown.value = 1;
            return;
        }
        played.current = fromRect;
        node.measureInWindow((x, y, width, height) => {
            if (!width || !height) {
                shown.value = 1;
                return;
            }
            if (reduce) {
                shown.value = withTiming(1, { duration: durations.base, easing: easings.out });
                return;
            }
            geo.value = {
                // surface: centre → centre, scaled to Home's box
                dx: fromRect.x + fromRect.width / 2 - (x + width / 2),
                dy: fromRect.y + fromRect.height / 2 - (y + height / 2),
                sx: fromRect.width / width,
                sy: fromRect.height / height,
                // content: left edge → left edge (the icon starts where Home's icon was)
                cdx: fromRect.x - x,
            };
            p.value = 1;
            shown.value = 1;
            p.value = withSpring(0, springs.sheet);
        });
    }, [fromRect, reduce]);

    // A new rect while mounted (tab screen kept alive) replays the flight.
    useEffect(() => {
        if (!validRect(fromRect)) {
            shown.value = 1;
            return;
        }
        if (played.current !== fromRect) shown.value = 0; // hide until measured, so it never jumps
        // Web lays out synchronously; native needs a frame before measureInWindow is meaningful.
        const id = requestAnimationFrame(play);
        return () => cancelAnimationFrame(id);
    }, [fromRect, play]);

    const surface = useAnimatedStyle(() => {
        const g = geo.value;
        const k = p.value;
        return {
            opacity: shown.value,
            transform: [
                { translateX: g.dx * k },
                { translateY: g.dy * k },
                { scaleX: 1 + (g.sx - 1) * k },
                { scaleY: 1 + (g.sy - 1) * k },
            ],
        };
    });
    const content = useAnimatedStyle(() => {
        const g = geo.value;
        const k = p.value;
        return { opacity: shown.value, transform: [{ translateX: g.cdx * k }, { translateY: g.dy * k }] };
    });
    const back = useAnimatedStyle(() => ({
        opacity: shown.value * interpolate(p.value, [0, 0.45], [1, 0], 'clamp'),
        transform: [{ translateX: interpolate(p.value, [0, 1], [0, -12], 'clamp') }],
    }));
    return { surface, content, back };
}

const SearchHeader = forwardRef(function SearchHeader({ value, onChangeText, onSubmit, onBack, onClear, isHi, fromRect }, ref) {
    const styles = useStyles();
    const { colors, isDark } = useTheme();
    const fieldRef = useRef(null);
    const motion = useFromRect(fromRect, fieldRef);

    return (
        <View style={styles.row}>
            <Animated.View style={motion.back}>
                <IconButton name="arrow-left" variant="ghost" onPress={onBack} accessibilityLabel="Go back" />
            </Animated.View>
            <View ref={fieldRef} collapsable={false} style={styles.field}>
                <Animated.View style={[styles.surface, motion.surface, { pointerEvents: 'none' }]} />
                <Animated.View style={[styles.content, motion.content]}>
                    <MaterialCommunityIcons name="magnify" size={22} color={colors.brandText} />
                    <View style={styles.inputWrap}>
                        <TextInput
                            ref={ref}
                            value={value}
                            onChangeText={onChangeText}
                            onSubmitEditing={onSubmit}
                            autoFocus
                            autoCorrect={false}
                            autoCapitalize="none"
                            returnKeyType="search"
                            selectionColor={colors.brand}
                            cursorColor={colors.brand}
                            keyboardAppearance={isDark ? 'dark' : 'light'}
                            accessibilityLabel={isHi ? 'सामान खोजें' : 'Search products'}
                            style={styles.input}
                            maxFontSizeMultiplier={1.3}
                        />
                        {!value ? (
                            <RotatingPlaceholder
                                items={isHi ? SUGGESTIONS_HI : SUGGESTIONS_EN}
                                prefix={isHi ? 'खोजें ' : 'Search for '}
                                style={[styles.placeholder, { pointerEvents: 'none' }]}
                            />
                        ) : null}
                    </View>
                    {value ? (
                        <IconButton
                            name="close-circle"
                            size="sm"
                            variant="ghost"
                            color={colors.inkMuted}
                            onPress={onClear}
                            accessibilityLabel={isHi ? 'खोज साफ़ करें' : 'Clear search'}
                        />
                    ) : null}
                </Animated.View>
            </View>
        </View>
    );
});

const useStyles = makeStyles((t) => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: space.xs,
        paddingRight: space.lg,
        paddingVertical: space.sm,
        gap: space.xs,
        zIndex: 1, // the flight starts below the header row; keep it above the list
    },
    field: {
        flex: 1,
        height: 48,
    },
    surface: {
        ...StyleSheet.absoluteFill,
        borderRadius: radii.input,
        // matches Home's SearchBar so the morph lands on the same surface
        backgroundColor: t.isDark ? t.colors.surfaceRaised : t.colors.surfaceSunken,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.isDark ? t.colors.border : t.colors.hairline,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: space.md,
        paddingRight: space.xs,
        gap: space.sm,
    },
    inputWrap: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
    },
    input: {
        ...StyleSheet.absoluteFill,
        ...type.body,
        color: t.colors.ink,
        paddingVertical: 0,
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null),
    },
    placeholder: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
}));

export default SearchHeader;
