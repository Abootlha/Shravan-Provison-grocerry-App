/**
 * GradientHeader — @deprecated name; renders a SOLID header surface (DESIGN.md: no gradients, no glow).
 *
 * The fill is the first stop of `gradient` (every theme gradient is flat now, so this is the solid the
 * role maps to), defaulting to the active theme's `surface`. Safe-area top padding and the gutter are
 * unchanged, so existing headers keep their layout.
 *
 * Props
 *   gradient     optional array — its first stop is used as the solid fill (default: colors.surface).
 *                gradients.header → surface; gradients.hero → ink #151515 (dark #232323);
 *                gradients.heroViolet → brand violet.
 *   color        explicit fill colour (wins over `gradient`)
 *   glow         @deprecated — ignored
 *   safeTop      boolean — pad by the top safe-area inset (default true)
 *   rounded      boolean — round the bottom corners (default FALSE now; a header is a flat band)
 *   hairline     boolean — 1px hairline under the header (default true when the fill is the surface)
 *   style        container style (default horizontal gutter + bottom 20)
 *   children
 *
 * Example
 *   <Screen edges={[]}>
 *     <GradientHeader>
 *       <Text variant="h1">Fruits & vegetables</Text>
 *     </GradientHeader>
 *   </Screen>
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, space } from '../../constants/theme';
import { useTheme } from '../../theme';

// eslint-disable-next-line no-unused-vars -- `glow` accepted for old call sites and ignored
export function GradientHeader({ gradient, color, glow, safeTop = true, rounded = false, hairline, style, children, ...rest }) {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const fill = color || (Array.isArray(gradient) && gradient.length ? gradient[0] : colors.surface);
    const isSurface = fill === colors.surface;
    const r = rounded ? radii.xl : 0;
    return (
        <View
            style={[
                styles.base,
                {
                    backgroundColor: fill,
                    paddingTop: (safeTop ? insets.top : 0) + space.sm,
                    borderBottomLeftRadius: r,
                    borderBottomRightRadius: r,
                },
                (hairline ?? isSurface) && { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.hairline },
                style,
            ]}
            {...rest}
        >
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    base: { overflow: 'hidden', paddingHorizontal: space.gutter, paddingBottom: space.xl },
});

export default GradientHeader;
