import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

/**
 * Rider app design tokens. One brand colour (violet, shared with the customer
 * app), neutral surfaces, and semantic colours for success / warning / danger.
 */

const brand = {
  violet: '#6C3CF4',
  violetPressed: '#5A2EDB',
  green: '#0C831F',
  red: '#C62828',
  amber: '#B26A00',
};

export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  textOnBrand: string;
  brand: string;
  brandPressed: string;
  brandSoft: string;
  brandText: string;
  success: string;
  successSoft: string;
  successText: string;
  warning: string;
  warningSoft: string;
  warningText: string;
  danger: string;
  dangerSoft: string;
  dangerText: string;
  info: string;
  infoSoft: string;
  overlay: string;
  offline: string;
  mapRoute: string;
  shadow: string;
};

const light: Palette = {
  bg: '#F4F4F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F6FA',
  surfaceRaised: '#FFFFFF',
  border: '#E7E5EE',
  borderStrong: '#D3D0DD',
  text: '#16141D',
  textMuted: '#5D5A68',
  textSubtle: '#8D8A98',
  textOnBrand: '#FFFFFF',
  brand: brand.violet,
  brandPressed: brand.violetPressed,
  brandSoft: '#EFE9FF',
  brandText: '#5326D6',
  success: brand.green,
  successSoft: '#E6F4E8',
  successText: '#0A6B1A',
  warning: '#E08A00',
  warningSoft: '#FFF4E0',
  warningText: brand.amber,
  danger: brand.red,
  dangerSoft: '#FDECEC',
  dangerText: '#A61F1F',
  info: '#1F6FD1',
  infoSoft: '#E8F1FC',
  overlay: 'rgba(14, 12, 20, 0.5)',
  offline: '#6E6B78',
  mapRoute: brand.violet,
  shadow: '#1B1530',
};

const dark: Palette = {
  bg: '#0F0E13',
  surface: '#1A1920',
  surfaceAlt: '#22202A',
  surfaceRaised: '#25232D',
  border: '#2E2C37',
  borderStrong: '#403D4B',
  text: '#F3F2F7',
  textMuted: '#B3B0BF',
  textSubtle: '#8A8796',
  textOnBrand: '#FFFFFF',
  brand: '#7D52F7',
  brandPressed: '#6C3CF4',
  brandSoft: '#2A2147',
  brandText: '#B9A2FF',
  success: '#2FA544',
  successSoft: '#13291A',
  successText: '#7FD68F',
  warning: '#F0A020',
  warningSoft: '#2E2414',
  warningText: '#F5C26B',
  danger: '#E5484D',
  dangerSoft: '#3A1719',
  dangerText: '#FF9592',
  info: '#4C94F0',
  infoSoft: '#15243A',
  overlay: 'rgba(0, 0, 0, 0.62)',
  offline: '#8A8796',
  mapRoute: '#9C7BFF',
  shadow: '#000000',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Families loaded in App.tsx; the system font is used until they are ready. */
export const fontFamilies = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type FontWeightName = keyof typeof fontFamilies;

let fontsReady = false;
export const setFontsReady = (ready: boolean): void => {
  fontsReady = ready;
};

const systemWeights: Record<FontWeightName, '400' | '500' | '600' | '700' | '800'> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

/** Font style for a weight; falls back to the system font if the custom one failed to load. */
export const font = (weight: FontWeightName = 'regular') =>
  fontsReady ? { fontFamily: fontFamilies[weight] } : { fontWeight: systemWeights[weight] };

export const typeScale = {
  display: { fontSize: 34, lineHeight: 40 },
  h1: { fontSize: 26, lineHeight: 32 },
  h2: { fontSize: 20, lineHeight: 26 },
  h3: { fontSize: 17, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 21 },
  bodySm: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 12, lineHeight: 16 },
  /** Small section / field label: sentence case, never uppercase-tracked. */
  overline: { fontSize: 12, lineHeight: 16 },
} as const;

export type TypeVariant = keyof typeof typeScale;

/** Minimum touch target while riding (gloves, vibration). */
export const TOUCH_TARGET = 52;

export type Theme = {
  dark: boolean;
  colors: Palette;
  spacing: typeof spacing;
  radii: typeof radii;
};

const lightTheme: Theme = { dark: false, colors: light, spacing, radii };
const darkTheme: Theme = { dark: true, colors: dark, spacing, radii };

export const useTheme = (): Theme => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
};

/** Memoised StyleSheet factory bound to the current theme. */
export const useStyles = <T>(factory: (theme: Theme) => T): T => {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
};

export const elevation = (theme: Theme, level: 1 | 2 | 3 = 1) => {
  if (theme.dark) {
    return { borderWidth: 1, borderColor: theme.colors.border };
  }
  const map = {
    1: { shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    2: { shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    3: { shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  } as const;
  return { shadowColor: theme.colors.shadow, ...map[level] };
};
