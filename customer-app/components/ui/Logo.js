/**
 * Logo — the Shravan Kirana brand mark and wordmark (original artwork, react-native-svg).
 *
 * Mark: a rounded, slightly tapered carry bag with a single die-cut arch handle and no letter — the same
 * bag family as the Mascot. FLAT: two colours only (brand violet + white), no gradients, no gold, no speed
 * glyphs (DESIGN.md). Wordmark: "shravan" in Bricolage Grotesque 800 + "kirana" in 600,
 * stored as outlines in ./logoPaths.js so it renders before (and without) any font loading.
 *
 * Props
 *   variant   'full' (mark + wordmark, default) | 'mark' | 'wordmark'
 *   tone      'light' (on white / canvas) | 'dark' (on the dark canvas) | 'brand' (white mark on a violet
 *             block). Default: follows the theme — 'light' in light mode, 'dark' in dark mode.
 *   size      height in pt of the mark (default 32). The wordmark scales with it.
 *   style
 *   accessibilityLabel  default 'Shravan Kirana'
 *
 * Example
 *   <Logo size={28} />                        // header lockup on white
 *   <Logo tone="brand" size={56} />           // white mark on a violet block
 *   <LogoMark size={20} />                    // tiny mark next to the ETA
 *
 * App icon / adaptive icon / splash (light + dark) / favicon PNGs in assets/brand/ are rendered from the
 * same MARK geometry with sharp (a small node script run from a temp dir outside the repo that reads
 * ./logoPaths.js); regenerate them when the geometry changes. Icon: white bag + violet handle cut on flat violet.
 * Splash: violet mark on white (dark: #7754F5 on #0F0F0F), matching screens/SplashScreen.js.
 */
import React, { memo, useId } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../constants/theme';
import { useTheme } from '../../theme';
import { HANDLE_W, MARK, WORDMARK } from './logoPaths';

// Flat, two-colour mark per tone. Violet values are the raw brand (mode-independent paint).
const TONES = {
    light: { body: colors.violet[600], cut: '#FFFFFF', word: '#151515', word2: colors.violet[600] },
    dark: { body: '#7754F5', cut: '#FFFFFF', word: '#F2F2F2', word2: '#A68BFF' },
    brand: { body: '#FFFFFF', cut: colors.violet[600], word: '#FFFFFF', word2: '#FFFFFF' },
};

// eslint-disable-next-line no-unused-vars -- `id` kept in the signature for old callers
const MarkSvg = ({ size, t, id }) => (
    <Svg width={size} height={size} viewBox={MARK.viewBox}>
        <Path d={MARK.body} fill={t.body} />
        <Path d={MARK.handle} fill="none" stroke={t.cut} strokeWidth={HANDLE_W} strokeLinecap="round" />
    </Svg>
);

const WordSvg = ({ height, t }) => (
    <Svg width={(height * WORDMARK.width) / WORDMARK.height} height={height} viewBox={WORDMARK.viewBox}>
        <Path d={WORDMARK.shravan} fill={t.word} />
        <Path d={WORDMARK.kirana} fill={t.word2} />
    </Svg>
);

export const Logo = memo(({ variant = 'full', tone, size = 32, style, accessibilityLabel = 'Shravan Kirana' }) => {
    const { isDark } = useTheme();
    const t = TONES[tone || (isDark ? 'dark' : 'light')] || TONES.light;
    const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
    const wordH = Math.round(size * 0.5);
    const a11y = { accessible: true, accessibilityRole: 'image', accessibilityLabel };

    if (variant === 'mark') {
        return (
            <View style={style} {...a11y}>
                <MarkSvg size={size} t={t} id={id} />
            </View>
        );
    }
    if (variant === 'wordmark') {
        return (
            <View style={style} {...a11y}>
                <WordSvg height={size} t={t} />
            </View>
        );
    }
    return (
        <View style={[{ flexDirection: 'row', alignItems: 'flex-end' }, style]} {...a11y}>
            <MarkSvg size={size} t={t} id={id} />
            {/* baseline sits on the bag's bottom edge (y 88 of 96) */}
            <View style={{ marginLeft: size * 0.16, marginBottom: size * (8 / 96) - wordH * (2 / WORDMARK.height) }}>
                <WordSvg height={wordH} t={t} />
            </View>
        </View>
    );
});

export const LogoMark = memo((props) => <Logo {...props} variant="mark" />);

export default Logo;
