/**
 * Design tokens — the single source of truth for colour, type, space, radius,
 * elevation and layering. Motion lives in `theme/motion.js` (re-exported here).
 * Visual decisions come from docs/design/DESIGN.md; this file implements it.
 *
 * Static (mode-independent) tokens:
 *   import { type, space, radii, z } from '../constants/theme';
 * Legacy code keeps working: COLORS, SIZES, FONTS, SHADOWS keep every key they had.
 *
 * LIGHT / DARK: the static `colors` / `gradients` / `shadows` / HEADER_THEMES exports are the LIGHT theme.
 * The dark palette (`darkColors`, `darkGradients`, `darkShadows`, `DARK_HEADER_THEMES`) is switched at
 * runtime — components read the active one with
 *   import { useTheme, makeStyles } from '../theme';   (see components/ui/README.md §0 and §9)
 *
 * Identity: a calm NEUTRAL frame + ONE brand colour. The colour on screen comes from the products
 * (packshots, produce), not the UI.
 *   neutral   canvas #F5F5F3 · surface #FFFFFF · image well #F2F2F0 · ink #151515 · hairline #E6E6E3
 *   violet    #6C3CF4 — ONLY where the user acts: primary button, ADD/stepper, active tab, links,
 *             selected state, focus ring. Pressed #5A2BE0. The ONE tint #F1ECFE = selected bg only.
 *   green     #0C831F — savings ONLY: discount amounts, "You saved", FREE delivery, veg mark, offer badge.
 *   red       #C62828 — errors / destructive.
 * Removed (keys kept, values remapped so old screens don't break): indigo "night" → ink #151515,
 * lavender washes → neutrals, gold → savings green, pastel category tints → the neutral image well,
 * every decorative gradient → a flat solid, glow → nothing.
 *
 * Contrast (WCAG 2.x, measured; body ≥4.5, large ≥3):
 *   ink #151515 on canvas 16.7 · on white 18.3
 *   inkSecondary #555555 on canvas 6.8
 *   inkMuted #6B6B6B on canvas 4.9 · on well #F2F2F0 4.75 · on white 5.3   (lowest text colour)
 *   white on brand #6C3CF4 5.85 · white on pressed #5A2BE0 7.4
 *   brand #6C3CF4 as text: white 5.85 · canvas 5.4 · brand tint #F1ECFE 5.1
 *   brandStrong #5A2BE0 on brand tint 6.4
 *   savings #0C831F on white 4.9 · white on #0C831F 4.9 · savings ink #0A6B1A on tint #E8F5EA 6.0
 *   error #C62828 on white 5.6 · white on error 5.6 · on errorTint 4.9
 *   white on ink surface #151515 18.3 · onNightSecondary #C9C9C9 11.0 · onNightMuted #A3A3A3 7.2
 */
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Colour scales
// ---------------------------------------------------------------------------

/** Brand violet. 600 is THE brand (#6C3CF4). White text is safe on 600–950 (5.85:1+). */
export const violet = {
    50: '#F7F4FF',
    100: '#F1ECFE', // the ONE brand tint (selected chip / row background)
    200: '#DCCCFF',
    300: '#C3A8FF',
    400: '#A27BFB',
    500: '#8655F7',
    600: '#6C3CF4', // brand
    alt: '#6C3CF4', // was the light end of the brand gradient; gradients are gone → identical to brand
    700: '#5A2BE0', // pressed
    800: '#4A20B4',
    900: '#3D1C8F',
    950: '#250F5C',
};

/**
 * @deprecated "Night" indigo is removed. The scale is now NEUTRAL ink greys so old imports render a
 * calm dark surface instead of indigo. 900 = ink #151515 (the floating dark surface).
 */
export const night = {
    50: '#F5F5F5',
    100: '#E8E8E8',
    200: '#C9C9C9',
    300: '#A3A3A3',
    400: '#7A7A7A',
    500: '#5C5C5C',
    600: '#444444',
    700: '#333333',
    800: '#262626',
    900: '#151515',
    950: '#0F0F0F',
};

/**
 * @deprecated Lavender washes are removed (DESIGN.md: "never lavender"). The scale is now warm
 * NEUTRALS so old imports stay calm. The selected-state tint is `colors.brandTint` (#F1ECFE).
 */
export const lavender = {
    25: '#FAFAF9',
    50: '#F5F5F3', // canvas
    100: '#F2F2F0', // image well / sunken
    200: '#E6E6E3', // hairline
    300: '#D6D6D2', // border
};

/** Savings green. Fills / text: 600 #0C831F; ink on the tint: 700 #0A6B1A. */
export const green = {
    50: '#E8F5EA', // savings tint
    100: '#D1EED6',
    200: '#A6DDAF',
    300: '#6DC67D',
    400: '#36A94B',
    500: '#189A2E',
    600: '#0C831F', // savings
    700: '#0A6B1A',
    800: '#085415',
    900: '#063D10',
};

/**
 * @deprecated Gold is removed (DESIGN.md). The scale now mirrors the SAVINGS green so any old
 * `goldScale[n]` / `gold[n]` reference renders as a savings colour, never yellow.
 */
export const gold = { ...green };

/** @deprecated legacy brand yellow — remapped to the savings green; do not use. */
export const yellow = { ...green };

/** Warm neutrals (DESIGN.md). Never use pure #000 for text. */
export const neutral = {
    0: '#FFFFFF',
    25: '#F5F5F3', // canvas
    50: '#F2F2F0', // sunken / image well / inputs
    100: '#E6E6E3', // hairline
    200: '#DADAD6', // border
    300: '#C4C4BF', // strong border
    400: '#A3A3A0', // disabled fills / icons
    500: '#8A8A87', // decorative only (<4.5:1)
    600: '#6B6B6B', // muted text (4.9:1 canvas)
    700: '#555555', // secondary text
    800: '#2E2E2E',
    900: '#151515', // ink
};

const flat = (c) => [c, c];

/**
 * Gradients — DESIGN.md: NONE, except the legibility `scrim` under text on photography.
 * Every legacy key is kept so <LinearGradient colors={…}> calls don't crash, but each one is FLAT
 * (all stops identical) and resolves to the solid that role now uses. Arrays keep their old length
 * (hero / heroViolet have 3 stops: some screens read `gradient[2]` as the solid behind them).
 */
export const gradients = {
    header: flat(neutral[0]), // Home / listing header → plain surface
    hero: [neutral[900], neutral[900], neutral[900]], // former indigo hero → flat ink surface (white text still reads)
    heroViolet: [violet[600], violet[600], violet[600]], // auth surface → flat brand violet (screen pass: move auth to white)
    brand: flat(violet[600]), // primary CTA fill → solid brand
    brandDeep: flat(violet[600]),
    night: flat(neutral[900]), // cart pill / dark floating surfaces → ink
    gold: flat(green[600]), // savings
    progress: flat(violet[600]), // progress fill → solid brand
    freeDelivery: flat(green[600]), // free-delivery progress → solid savings green
    glow: flat('rgba(0,0,0,0)'), // glow removed
    glowGold: flat('rgba(0,0,0,0)'),
    canvasWash: flat(neutral[25]), // no wash: canvas
    scrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'], // THE one gradient: legibility under text on photos (top → bottom)
};

/**
 * Semantic colour roles. Prefer these over raw scales in components.
 */
export const colors = {
    // Brand
    brand: violet[600],
    brandStrong: violet[700], // pressed fill; violet ink on the brand tint
    brandText: violet[600], // violet AS TEXT / icons / links (dark: lifted #A68BFF)
    brandTint: violet[100], // #F1ECFE — the ONE tint: selected chip / row background only
    accent: violet[600], // = brand (name kept for compatibility)
    accentStrong: violet[700],
    accentTint: violet[100],
    violet,
    night,
    lavender,
    // gold roles → savings green (nothing gold is visible any more)
    gold: green[600],
    goldScale: gold,
    goldStrong: green[700],
    goldTint: green[50],
    goldInk: green[700],
    onGold: neutral[0],
    yellow, // @deprecated
    green,
    neutral,
    gradient: gradients,

    // Surfaces
    canvas: neutral[25], // app background — warm neutral
    surface: neutral[0], // cards, sheets, header, dock
    surfaceSunken: neutral[50], // inputs, inset wells
    surfaceInverse: neutral[900], // toasts, dark pills (ink, never indigo)
    surfaceNight: neutral[900], // former indigo night → ink #151515
    surfaceNightRaised: neutral[800],
    surfaceRaised: neutral[0], // elevated layer above `surface` — white in light
    imageWell: neutral[50], // #F2F2F0 behind product packshots
    imageWellGlow: 'rgba(255,255,255,0)', // WellLight removed → transparent in both themes
    imageWellShadow: neutral[900], // contact-shadow ink under cut-outs
    imageBlend: 'multiply', // web mix-blend-mode for packshots on the well (dark: 'normal')

    // Text
    ink: neutral[900],
    inkStrong: neutral[900], // headings, prices
    inkSecondary: neutral[700],
    inkMuted: neutral[600],
    inkDisabled: neutral[400],
    inkInverse: neutral[0],
    onBrand: neutral[0], // white on violet (5.85:1)
    onAccent: neutral[0],
    onNight: neutral[0],
    onNightSecondary: night[200],
    onNightMuted: night[300],
    onError: neutral[0],

    // Lines
    hairline: neutral[100],
    border: neutral[200],
    borderStrong: neutral[300],
    highlight: 'rgba(255,255,255,0)', // lit top edge removed (kept transparent so spreads are harmless)
    highlightOnBrand: 'rgba(255,255,255,0)',

    // "Glass" — SOLID by default (DESIGN.md: blur max 2 uses, only over photos/maps; see GlassSurface allowBlur)
    glassFill: neutral[0],
    glassBorder: neutral[100],
    glassFillNight: neutral[900],
    glassBorderNight: 'rgba(255,255,255,0.10)',
    glassSolid: neutral[0], // dock / floating chrome fill
    glassSolidNight: neutral[900],
    haloOnBrand: 'rgba(255,255,255,0.12)', // flat disc behind an icon on violet / ink (no glow)

    // Category tiles: pastel tints REMOVED — every key is the neutral image well + ink
    tint: {
        violet: neutral[50],
        gold: neutral[50],
        peach: neutral[50],
        sky: neutral[50],
        lilac: neutral[50],
        mint: neutral[50],
        rose: neutral[50],
        green: neutral[50],
        yellow: neutral[50], // @deprecated
    },
    tileInk: {
        violet: neutral[900],
        gold: neutral[900],
        peach: neutral[900],
        sky: neutral[900],
        lilac: neutral[900],
        mint: neutral[900],
        rose: neutral[900],
        green: neutral[900],
        yellow: neutral[900], // @deprecated
    },

    // Semantic
    success: green[600], // savings / FREE / veg / delivered (white on it 4.9:1; as text on white 4.9:1)
    successStrong: green[700],
    successInk: green[700], // savings text on successTint (6.0:1)
    successTint: green[50],
    onSuccess: neutral[0],
    error: '#C62828', // fills / icons / text (white on it 5.6:1; on white 5.6:1)
    errorInk: '#C62828',
    errorTint: '#FDECEC',
    warning: '#9A5200', // functional amber text (5.3:1 on warningTint) — warnings only, never decoration
    warningTint: '#FFF1DF',
    info: '#3D3D3D', // blue removed: neutral info ink (9.7:1 on infoTint)
    infoTint: neutral[50],
    offer: green[600], // discount badge FILL → savings green (text on it = onGold, white 4.9:1)
    offerInk: green[600], // savings text on white
    rating: green[600], // star glyphs (the number beside it carries the info)
    veg: green[600],

    // Overlays
    scrim: 'rgba(0,0,0,0.5)',
    scrimLight: 'rgba(0,0,0,0.24)',
    onImageScrim: 'rgba(0,0,0,0.36)',
    shimmer: 'rgba(255,255,255,0.7)',
    pressOverlay: 'rgba(0,0,0,0.05)',
};

/** Ordered list of tile tint keys (kept for index cycling; every key is now the same neutral well). */
export const TILE_TINTS = ['violet', 'peach', 'sky', 'gold', 'mint', 'rose'];

/** Returns `{ bg, ink }` for a tile at `index` — always the neutral image well + ink now. */
export const tileTint = (index = 0) => {
    const key = TILE_TINTS[Math.abs(index) % TILE_TINTS.length];
    return { key, bg: colors.tint[key], ink: colors.tileInk[key] };
};

/**
 * Header surface themes. DESIGN.md: the Home/listing header is the plain SURFACE (white / dark
 * surface) with ink; the per-category re-tint is removed — every category key maps to `default`.
 * The selected category tab indicator (violet underline) is the only state colour.
 *   bg · ink · inkSecondary · statusBar · searchBg · gradient (flat, for <GradientHeader>)
 * `brand` (auth / splash) is a flat violet surface with white ink and `night` a flat ink surface,
 * both kept only so those screens stay legible until the screen pass moves them to white.
 */
const surfaceHeader = {
    bg: neutral[0],
    ink: neutral[900],
    inkSecondary: neutral[700],
    statusBar: 'dark',
    searchBg: neutral[50],
    gradient: gradients.header,
};
export const HEADER_THEMES = {
    default: surfaceHeader,
    brand: {
        bg: violet[600],
        ink: neutral[0],
        inkSecondary: violet[100], // #F1ECFE on #6C3CF4 5.0:1
        statusBar: 'light',
        searchBg: neutral[0],
        gradient: gradients.heroViolet,
    },
    fresh: surfaceHeader,
    dairy: surfaceHeader,
    snacks: surfaceHeader,
    festive: surfaceHeader,
    night: {
        bg: neutral[900],
        ink: neutral[0],
        inkSecondary: night[200],
        statusBar: 'light',
        searchBg: neutral[0],
        gradient: gradients.night,
    },
};

// ---------------------------------------------------------------------------
// Typography — Plus Jakarta Sans for everything; Bricolage Grotesque for the 2–3 largest headings only
// ---------------------------------------------------------------------------

/**
 * Font family per weight. On Android a custom font ignores `fontWeight`, so always
 * pick weight via fontFamily, never via fontWeight.
 */
export const fontFamily = {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
};

/**
 * Display face — Bricolage Grotesque, ONLY for `hero` / `display` / `h1` (screen titles, the Home
 * ETA line, the wordmark). h2 and everything smaller is Plus Jakarta Sans.
 */
export const displayFamily = {
    semibold: 'BricolageGrotesque_600SemiBold',
    bold: 'BricolageGrotesque_700Bold',
    extrabold: 'BricolageGrotesque_800ExtraBold',
};

/** Variants set in the display face. <Text weight> on these picks a displayFamily weight when one exists. */
export const DISPLAY_VARIANTS = ['hero', 'display', 'h1'];

const tabular = ['tabular-nums'];

/**
 * Type scale. Each entry is a ready-to-spread TextStyle (no colour).
 * Use through <Text variant="h2"> or `...type.h2` in a StyleSheet.
 * No uppercase, no wide tracking anywhere: small labels are sentence case 12/600.
 */
export const type = {
    hero: { fontFamily: displayFamily.bold, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
    display: { fontFamily: displayFamily.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
    h1: { fontFamily: displayFamily.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
    h2: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
    h3: { fontFamily: fontFamily.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
    title: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
    body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
    bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
    label: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
    caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    micro: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0 }, // sentence case 12/600
    button: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
    price: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20, letterSpacing: -0.1, fontVariant: tabular },
    priceLarge: { fontFamily: fontFamily.extrabold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, fontVariant: tabular },
    priceHero: { fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, fontVariant: tabular }, // PDP / checkout total
    priceStrike: {
        fontFamily: fontFamily.medium,
        fontSize: 12,
        lineHeight: 16,
        letterSpacing: 0,
        fontVariant: tabular,
        textDecorationLine: 'line-through',
    },
    counter: { fontFamily: fontFamily.extrabold, fontSize: 14, lineHeight: 18, letterSpacing: 0, fontVariant: tabular },
};

// ---------------------------------------------------------------------------
// Space, radius, layering
// ---------------------------------------------------------------------------

/** 4-based spacing scale. `space.lg` (16) is the screen gutter. */
export const space = {
    none: 0,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
    '6xl': 64,
    gutter: 16,
};

/** Multiply the 4pt base: s(3) === 12. */
export const s = (n) => n * 4;

/**
 * Radii (DESIGN.md "Shape"). Prefer the ROLE keys; the size keys are kept for old code and remapped
 * onto the role values. No pill shapes except avatar / icon-button circles (`pill` = circle helper).
 */
export const radii = {
    none: 0,
    // roles
    chip: 8,
    add: 8, // ADD / stepper compact rounded rect
    button: 10,
    input: 10,
    well: 10, // product image wells
    card: 12,
    sheet: 16, // bottom sheets (top corners)
    dock: 18,
    // legacy size keys → role values
    xs: 6, // tiny tags, count badges
    sm: 10, // inputs, wells, buttons
    md: 12, // cards
    lg: 12, // large cards / banners (cards cap at 12)
    xl: 16, // floating panels
    pill: 999, // CIRCLES ONLY (avatars, icon buttons, dots) — never a button / chip / badge shape
};

/** Layering (zIndex). Keep overlays in this order. */
export const z = {
    base: 0,
    raised: 1,
    sticky: 10,
    header: 20,
    tabBar: 30,
    overlay: 40,
    sheet: 50,
    toast: 60,
    max: 100,
};

/** Minimum touch target in points (Apple HIG / Material). */
export const HIT = 44;

// ---------------------------------------------------------------------------
// Elevation — ONE level (DESIGN.md): only things that float above content get a shadow
// (dock, cart pill, active-order bar, sheets, toasts, controls over a map). Cards are flat + hairline.
// ---------------------------------------------------------------------------

const SHADOW_INK = '#000000';

const FLOATING = Platform.select({
    web: { boxShadow: '0px 4px 16px rgba(0,0,0,0.08)' },
    android: { elevation: 4, shadowColor: SHADOW_INK },
    default: { shadowColor: SHADOW_INK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8 },
});
const NONE = Platform.select({ web: { boxShadow: 'none' }, android: { elevation: 0 }, default: { shadowOpacity: 0 } });

/**
 * Elevation. Spread into a style: `{ ...shadows.floating }`.
 *   none · sm (= none: resting cards are flat, use a hairline) · md / lg / floating (= the ONE floating
 *   level) · glow (= none: glow is removed).
 * A shadowed view needs a backgroundColor or Android draws nothing.
 */
export const shadows = {
    none: NONE,
    sm: NONE,
    md: FLOATING,
    lg: FLOATING,
    floating: FLOATING,
    glow: NONE,
};

/** Former violet offset under ADD → a plain 1px brand border. */
export const hardEdge = { borderWidth: 1, borderColor: violet[600] };

/** Lit top edge — removed. Kept as harmless transparent spreads for old code. */
export const highlightTop = { borderTopWidth: 0, borderTopColor: colors.highlight };
export const highlightTopOnBrand = { borderTopWidth: 0, borderTopColor: colors.highlightOnBrand };

// ---------------------------------------------------------------------------
// DARK THEME — neutral, not purple (DESIGN.md "Colour (dark)"). Runtime switching lives in
// theme/ThemeProvider.js (useTheme / makeStyles). The static `colors` export above is LIGHT.
// ---------------------------------------------------------------------------
//
// Raw scales (violet, night, lavender, goldScale, green, neutral, yellow) are IDENTICAL in both
// palettes. Only semantic roles change; everything on canvas / surface must use semantic roles.
//
// Contrast (WCAG 2.x, measured):
//   ink #F2F2F2 ........ canvas #0F0F0F 17.1 · surface #1A1A1A 15.6
//   inkSecondary #B3B3B3 surface 8.3 · raised #232323 7.5
//   inkMuted #8F8F8F ... canvas 5.9 · surface 5.4 · raised 4.9   (lowest text colour)
//   white on brand fill #7754F5 4.8 (all text sizes)
//   brandText #A68BFF .. canvas 7.1 · surface 6.4 · raised 5.8 · on brandTint 5.5
//   brandStrong #C4B2FF on brandTint 7.9
//   savings #4CC26A on surface 7.7 · onSuccess #0B1F12 on #4CC26A 7.6
//   errorInk #FF8A80 on surface 7.6
//   white on raised #232323 15.7 (cart pill / toasts)

/** Dark gradients — same keys as `gradients`, all flat except `scrim`. */
export const darkGradients = {
    header: flat('#1A1A1A'),
    hero: ['#232323', '#232323', '#232323'],
    heroViolet: gradients.heroViolet,
    brand: flat('#7754F5'),
    brandDeep: flat('#7754F5'),
    night: flat('#232323'),
    gold: flat('#4CC26A'),
    progress: flat('#7754F5'),
    freeDelivery: flat('#4CC26A'),
    glow: flat('rgba(0,0,0,0)'),
    glowGold: flat('rgba(0,0,0,0)'),
    canvasWash: flat('#0F0F0F'),
    scrim: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)'],
};

const D = {
    canvas: '#0F0F0F',
    surface: '#1A1A1A',
    raised: '#232323',
    sunken: '#202020',
    well: '#202020',
    ink: '#F2F2F2',
    ink2: '#B3B3B3',
    muted: '#8F8F8F',
    brand: '#7754F5',
    brandText: '#A68BFF',
    brandSoft: '#C4B2FF',
    brandTint: 'rgba(139,107,255,0.16)',
    savings: '#4CC26A',
    savingsTint: 'rgba(76,194,106,0.14)',
};

/** Dark semantic palette — mirrors EVERY key of `colors` (a dev check in ThemeProvider warns on drift). */
export const darkColors = {
    // Brand
    brand: D.brand,
    brandStrong: D.brandSoft, // violet ink on brandTint (fill use: prefer `brand`)
    brandText: D.brandText,
    brandTint: D.brandTint,
    accent: D.brand,
    accentStrong: D.brandSoft,
    accentTint: D.brandTint,
    violet,
    night,
    lavender,
    gold: D.savings,
    goldScale: gold,
    goldStrong: D.savings,
    goldTint: D.savingsTint,
    goldInk: D.savings,
    onGold: '#0B1F12',
    yellow,
    green,
    neutral,
    gradient: darkGradients,

    // Surfaces
    canvas: D.canvas,
    surface: D.surface,
    surfaceSunken: D.sunken,
    surfaceInverse: D.ink, // true inverse: light chip / pin on the dark canvas
    surfaceNight: D.raised, // floating dark surface (cart pill, toasts): raised + hairline
    surfaceNightRaised: '#2C2C2C',
    surfaceRaised: D.raised,
    imageWell: D.well,
    imageWellGlow: 'rgba(255,255,255,0)',
    imageWellShadow: '#000000',
    imageBlend: 'normal',

    // Text
    ink: D.ink,
    inkStrong: D.ink,
    inkSecondary: D.ink2,
    inkMuted: D.muted,
    inkDisabled: '#5C5C5C',
    inkInverse: D.surface,
    onBrand: '#FFFFFF',
    onAccent: '#FFFFFF',
    onNight: '#FFFFFF',
    onNightSecondary: D.ink2,
    onNightMuted: D.muted,
    onError: '#FFFFFF',

    // Lines
    hairline: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.12)',
    borderStrong: 'rgba(255,255,255,0.20)',
    highlight: 'rgba(255,255,255,0)',
    highlightOnBrand: 'rgba(255,255,255,0)',

    // "Glass" — solid
    glassFill: D.surface,
    glassBorder: 'rgba(255,255,255,0.08)',
    glassFillNight: D.raised,
    glassBorderNight: 'rgba(255,255,255,0.08)',
    glassSolid: D.surface,
    glassSolidNight: D.raised,
    haloOnBrand: 'rgba(255,255,255,0.12)',

    // Tiles: neutral well + ink
    tint: {
        violet: D.well,
        gold: D.well,
        peach: D.well,
        sky: D.well,
        lilac: D.well,
        mint: D.well,
        rose: D.well,
        green: D.well,
        yellow: D.well, // @deprecated
    },
    tileInk: {
        violet: D.ink,
        gold: D.ink,
        peach: D.ink,
        sky: D.ink,
        lilac: D.ink,
        mint: D.ink,
        rose: D.ink,
        green: D.ink,
        yellow: D.ink, // @deprecated
    },

    // Semantic
    success: D.savings, // fill AND text on dark; text on a success fill = onSuccess (dark ink)
    successStrong: '#3FAE5C',
    successInk: D.savings,
    successTint: D.savingsTint,
    onSuccess: '#0B1F12',
    error: '#C62828',
    errorInk: '#FF8A80',
    errorTint: 'rgba(255,90,80,0.14)',
    warning: '#FFB65C',
    warningTint: 'rgba(255,160,60,0.14)',
    info: D.ink2,
    infoTint: 'rgba(255,255,255,0.06)',
    offer: D.savings,
    offerInk: D.savings,
    rating: D.savings,
    veg: D.savings,

    // Overlays
    scrim: 'rgba(0,0,0,0.64)',
    scrimLight: 'rgba(0,0,0,0.40)',
    onImageScrim: 'rgba(0,0,0,0.48)',
    shimmer: 'rgba(255,255,255,0.06)',
    pressOverlay: 'rgba(255,255,255,0.06)',
};

const DARK_FLOATING = Platform.select({
    web: { boxShadow: '0px 4px 16px rgba(0,0,0,0.4), 0px 0px 0px 1px rgba(255,255,255,0.08)' },
    android: { elevation: 4, shadowColor: '#000000' },
    default: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
});

/** Dark elevation — same keys as `shadows`: one floating level (black 40% + hairline ring on web). */
export const darkShadows = {
    none: NONE,
    sm: NONE,
    md: DARK_FLOATING,
    lg: DARK_FLOATING,
    floating: DARK_FLOATING,
    glow: NONE,
};

export const darkHardEdge = { borderWidth: 1, borderColor: D.brandText };

/** Dark header themes — same keys/shape as HEADER_THEMES: every category is the plain dark surface. */
const darkSurfaceHeader = { bg: D.surface, ink: D.ink, inkSecondary: D.ink2, statusBar: 'light', searchBg: D.raised, gradient: darkGradients.header };
export const DARK_HEADER_THEMES = {
    default: darkSurfaceHeader,
    brand: HEADER_THEMES.brand,
    fresh: darkSurfaceHeader,
    dairy: darkSurfaceHeader,
    snacks: darkSurfaceHeader,
    festive: darkSurfaceHeader,
    night: { bg: D.raised, ink: '#FFFFFF', inkSecondary: D.ink2, statusBar: 'light', searchBg: D.raised, gradient: darkGradients.night },
};

const makeTileTint = (palette) => (index = 0) => {
    const key = TILE_TINTS[Math.abs(index) % TILE_TINTS.length];
    return { key, bg: palette.tint[key], ink: palette.tileInk[key] };
};

const buildTheme = (scheme) => {
    const dark = scheme === 'dark';
    const c = dark ? darkColors : colors;
    return {
        scheme,
        isDark: dark,
        colors: c,
        gradients: dark ? darkGradients : gradients,
        shadows: dark ? darkShadows : shadows,
        hardEdge: dark ? darkHardEdge : hardEdge,
        highlightTop: { borderTopWidth: 0, borderTopColor: c.highlight },
        highlightTopOnBrand: { borderTopWidth: 0, borderTopColor: c.highlightOnBrand },
        headerThemes: dark ? DARK_HEADER_THEMES : HEADER_THEMES,
        tileTint: makeTileTint(c),
        // static tokens, for convenience inside makeStyles((t) => …)
        type,
        fontFamily,
        displayFamily,
        space,
        s,
        radii,
        z,
        HIT,
    };
};

/**
 * Both resolved themes. React code reads the active one with `useTheme()` (theme/ThemeProvider.js);
 * non-React code (map styles, notification colours) can read `themes.light` / `themes.dark` directly.
 */
export const themes = { light: buildTheme('light'), dark: buildTheme('dark') };

// ---------------------------------------------------------------------------
// Motion (re-exported for discoverability; see theme/motion.js)
// ---------------------------------------------------------------------------
export { motion, springs, durations, easings, press, stagger, staggerDelay, transitions, layout } from '../theme/motion';

// ---------------------------------------------------------------------------
// LEGACY EXPORTS — kept key-for-key so un-migrated screens keep working.
// Do not use in new code; prefer `colors`, `type`, `space`, `radii`, `shadows`.
// ---------------------------------------------------------------------------

export const COLORS = {
    // Primary brand colors (violet identity)
    primary: violet[600],
    secondary: neutral[900],
    accent: violet[600],

    // Background colors
    background: neutral[25],
    white: '#FFFFFF',
    surface: '#FFFFFF',
    canvas: colors.canvas,

    // Text colors
    text: neutral[900],
    textSecondary: neutral[700],
    textLight: neutral[600],

    // Status colors
    success: green[600],
    error: '#C62828',
    warning: '#9A5200',
    info: '#3D3D3D',

    // Neutral colors
    black: '#000000',
    gray: neutral[500],
    lightGray: neutral[100],
    border: neutral[200],

    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
};

export const SIZES = {
    base: 8,
    font: 14,
    radius: 8,
    padding: 16,
    h1: 28,
    h2: 24,
    h3: 20,
    h4: 16,
    body: 14,
    caption: 12,
    small: 10,
    width: null,
    height: null,
};

export const FONTS = {
    h1: { fontSize: SIZES.h1, fontWeight: '700', color: COLORS.text },
    h2: { fontSize: SIZES.h2, fontWeight: '600', color: COLORS.text },
    h3: { fontSize: SIZES.h3, fontWeight: '600', color: COLORS.text },
    h4: { fontSize: SIZES.h4, fontWeight: '500', color: COLORS.text },
    body: { fontSize: SIZES.body, fontWeight: '400', color: COLORS.text },
    caption: { fontSize: SIZES.caption, fontWeight: '400', color: COLORS.textSecondary },
};

export const SHADOWS = {
    light: {
        shadowColor: SHADOW_INK,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    medium: {
        shadowColor: SHADOW_INK,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    dark: {
        shadowColor: SHADOW_INK,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
};

/** Aggregate for convenience: `import { theme } from '../constants/theme'`. */
export const theme = { colors, gradients, type, fontFamily, displayFamily, space, s, radii, shadows, highlightTop, highlightTopOnBrand, z, HIT, HEADER_THEMES, TILE_TINTS, tileTint };
