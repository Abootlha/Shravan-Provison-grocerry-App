/**
 * Text — the only text component new screens should use.
 *
 * Props
 *   variant        'hero'|'display'|'h1'|'h2'|'h3'|'title'|'body'|'bodyStrong'|'label'|'caption'|'micro'
 *                  |'button'|'price'|'priceLarge'|'priceHero'|'priceStrike'|'counter'   (default 'body')
 *   color          token name ('ink'|'strong'|'secondary'|'muted'|'disabled'|'inverse'|'onBrand'|'onNight'
 *                  |'onNightSecondary'|'brand'|'accent'|'success'|'successInk'|'savings'|'error'|'warning'|'info'|'offer'|'gold'
 *                  |'goldInk') or any colour string. Default 'ink'. Tokens resolve against the ACTIVE
 *                  theme ('brand'/'accent' → colors.brandText, the text-safe violet in both modes);
 *                  a raw colour string is used as-is (so pass tokens, not hex, in themed code).
 *   weight         'regular'|'medium'|'semibold'|'bold'|'extrabold' — overrides the variant's weight
 *                  (use for mixed-weight headlines; never set fontWeight)
 *   align          'left'|'center'|'right'
 *   uppercase      @deprecated — ignored. DESIGN.md: no uppercase micro labels; small labels are sentence case 12/600.
 *   tabular        boolean — force tabular numerals (prices/counters already have them)
 *   numberOfLines  passthrough; ellipsizes
 *   style          extra TextStyle (applied last)
 *   ...rest        any RN Text prop
 *
 * Display face: Bricolage Grotesque is used ONLY by hero / display / h1 (the 2–3 largest headings on a
 * screen). h2 and smaller are Plus Jakarta Sans.
 *
 * Mixed-weight headlines (<Headline> / <Em>) — DOSE CAP: max ONE per screen, and only on the Home
 * hero line and the tracking ETA (DESIGN.md "Typography"). Section titles are plain <Text variant="h2">.
 *   <Headline variant="display" lead="Delivery in" emphasis="12 minutes" emphasisColor="brand" />
 *
 * Example
 *   <Text variant="h2">Fresh fruits</Text>
 *   <Text variant="caption" color="muted" numberOfLines={1}>500 g</Text>
 *   <Text variant="price">₹48</Text> <Text variant="priceStrike" color="muted">₹60</Text>
 */
import React from 'react';
import { Platform, StyleSheet, Text as RNText } from 'react-native';
import { useSelector } from 'react-redux';
import { colors, type, fontFamily, displayFamily, DISPLAY_VARIANTS, toDevanagari } from '../../constants/theme';
import { useTheme } from '../../theme';

/** Font for a weight: the display face on hero/display/h1 (when it has that weight), else Plus Jakarta. */
const familyFor = (variant, weight) =>
    (DISPLAY_VARIANTS.includes(variant) && displayFamily[weight]) || fontFamily[weight];

/** Text colour tokens → palette keys. */
const TEXT_KEYS = {
    ink: 'ink',
    strong: 'inkStrong',
    secondary: 'inkSecondary',
    muted: 'inkMuted',
    disabled: 'inkDisabled',
    inverse: 'inkInverse',
    onBrand: 'onBrand',
    onAccent: 'onAccent',
    onNight: 'onNight',
    onNightSecondary: 'onNightSecondary',
    brand: 'brandText',
    accent: 'brandText',
    success: 'success',
    // Savings green TEXT that also sits on the green tint (chips, badges): light #0A6B1A (6.0:1 on
    // #E8F5EA, 6.9:1 on white; #0C831F is only 4.4:1 on the tint), dark #4CC26A (6.0:1 on the tint).
    successInk: 'successInk',
    error: 'errorInk',
    warning: 'warning',
    info: 'info',
    offer: 'offerInk', // savings green text; the offer badge FILL is colors.offer
    gold: 'gold', // @deprecated — gold is removed; resolves to the savings green
    goldInk: 'goldInk', // @deprecated — savings green ink
    savings: 'success',
};

/**
 * Resolve a Text colour token (or raw colour) against a palette. Pass the active palette from
 * useTheme().colors; it defaults to the static LIGHT palette for legacy callers.
 */
export const resolveTextColor = (c, palette = colors) => (c ? (TEXT_KEYS[c] ? palette[TEXT_KEYS[c]] : c) : palette.ink);

/** @deprecated static LIGHT values — use resolveTextColor(token, useTheme().colors). */
export const TEXT_COLORS = {
    ink: colors.ink,
    strong: colors.inkStrong,
    secondary: colors.inkSecondary,
    muted: colors.inkMuted,
    disabled: colors.inkDisabled,
    inverse: colors.inkInverse,
    onBrand: colors.onBrand,
    onAccent: colors.onAccent,
    onNight: colors.onNight,
    onNightSecondary: colors.onNightSecondary,
    brand: colors.brand,
    accent: colors.accent,
    success: colors.success,
    successInk: colors.successInk,
    error: colors.errorInk,
    warning: colors.warning,
    info: colors.info,
    offer: colors.offerInk,
    gold: colors.gold, // @deprecated → savings green
    goldInk: colors.goldInk,
    savings: colors.success,
};

const NATIVE = Platform.OS !== 'web';
const identity = (style) => style;

/**
 * Native + Hindi: returns a function that swaps a style's brand fontFamily for the Noto Devanagari
 * family of the same weight (web needs nothing: its font tokens are already CSS stacks with Noto as
 * the Devanagari fallback, see constants/theme devanagariFamily). Use it for text that doesn't go
 * through <Text>: button labels, TextInputs.
 *   const script = useScriptFamily();  <TextInput style={script([styles.input, type.body])} />
 */
export function useScriptFamily() {
    const hindi = useSelector((s) => (s.language?.currentLanguage || s.auth?.language) === 'hi');
    if (!NATIVE || !hindi) return identity;
    return (style) => {
        const fam = StyleSheet.flatten(style)?.fontFamily;
        const next = fam && toDevanagari(fam);
        return next && next !== fam ? [style, { fontFamily: next }] : style;
    };
}

export function Text({
    variant = 'body',
    color = 'ink',
    weight,
    align,
    uppercase, // eslint-disable-line no-unused-vars -- accepted and ignored (sentence case only)
    tabular,
    style,
    maxFontSizeMultiplier = 1.4,
    children,
    ...rest
}) {
    const v = type[variant] || type.body;
    const { colors: palette } = useTheme();
    const script = useScriptFamily();
    return (
        <RNText
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            style={script([
                v,
                { color: resolveTextColor(color, palette) },
                weight && fontFamily[weight] && { fontFamily: familyFor(variant, weight) },
                align && { textAlign: align },
                tabular && { fontVariant: ['tabular-nums'] },
                style,
            ])}
            {...rest}
        >
            {children}
        </RNText>
    );
}

/**
 * Inline emphasis inside a <Text>: switches to extrabold (and optionally a colour).
 * Pass `display` inside a headline to set the emphasis in the display face (Bricolage).
 */
export function Em({ color, weight = 'extrabold', display = false, style, children }) {
    const family = (display && displayFamily[weight]) || fontFamily[weight];
    const { colors: palette } = useTheme();
    const script = useScriptFamily();
    return <RNText style={script([{ fontFamily: family }, color && { color: resolveTextColor(color, palette) }, style])}>{children}</RNText>;
}

/**
 * Headline — mixed-weight heading: a light `lead` and an extrabold `emphasis` in one line.
 * The lead is Plus Jakarta regular; the emphasis is the display face on hero/display/h1.
 * DOSE CAP: max ONE Headline per screen (Home hero line, tracking ETA). Everything else uses <Text>.
 * Props: lead, emphasis, trail, variant ('h1' default | 'hero' | 'display' | 'h2'), color,
 *        emphasisColor, leadWeight ('regular' default), align, numberOfLines, style, accessibilityRole ('header').
 */
export function Headline({
    lead,
    emphasis,
    trail,
    variant = 'h1',
    color = 'ink',
    emphasisColor,
    leadWeight = 'regular',
    style,
    ...rest
}) {
    return (
        <Text variant={variant} color={color} weight={leadWeight} accessibilityRole="header" style={style} {...rest}>
            {lead ? `${lead} ` : ''}
            {emphasis ? (
                <Em color={emphasisColor} display={DISPLAY_VARIANTS.includes(variant)}>
                    {emphasis}
                </Em>
            ) : null}
            {trail ? ` ${trail}` : ''}
        </Text>
    );
}

export default Text;
