/**
 * Auth layout pieces shared by Onboarding, Login, OTP and Language (DESIGN.md "Auth/onboarding").
 *
 *   AuthBar      the top bar: optional back button (left), the centred logo lockup, optional right slot
 *                (Onboarding's Skip). Pads the safe-area top itself. Geometry lives in authMotion.AUTH_BAR,
 *                because the Splash flies its mark to exactly this spot.
 *   AuthHeading  a plain screen title (h1, one weight) + an optional secondary line. No mixed-weight
 *                headline, no mascot, no stickers, no gradient — the screen is a flat canvas.
 *
 * Props
 *   AuthBar:     onBack, backLabel ('Go back'), right (node), logoStyle (animated style for the Splash hand-off)
 *   AuthHeading: title, subtitle, align ('left'), style
 */
import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../../constants/theme';
import { makeStyles } from '../../theme';
import { IconButton, Logo, Text } from '../../components/ui';
import { AUTH_BAR } from './authMotion';

const SIDE = 64; // equal side slots keep the logo centred

export function AuthBar({ onBack, backLabel = 'Go back', right, logoStyle }) {
    const styles = useStyles();
    const insets = useSafeAreaInsets();
    return (
        <View style={{ paddingTop: insets.top + AUTH_BAR.PAD_TOP }}>
        <View style={styles.bar}>
            <View style={styles.side}>
                {onBack ? <IconButton name="arrow-left" variant="ghost" size="md" accessibilityLabel={backLabel} onPress={onBack} /> : null}
            </View>
            <Animated.View style={logoStyle}>
                <Logo size={AUTH_BAR.LOGO} />
            </Animated.View>
            <View style={[styles.side, styles.sideRight]}>{right}</View>
        </View>
        </View>
    );
}

export function AuthHeading({ title, subtitle, align = 'left', style }) {
    const styles = useStyles();
    return (
        <View style={[styles.heading, style]}>
            <Text variant="h1" align={align} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text variant="body" color="secondary" align={align}>{subtitle}</Text> : null}
        </View>
    );
}

/** @deprecated kept so stale imports don't crash; renders the bar only. */
export function AuthHero(props) {
    return <AuthBar {...props} />;
}

const useStyles = makeStyles(() => ({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: AUTH_BAR.MIN_H,
        paddingHorizontal: space.sm,
    },
    side: { width: SIDE, minHeight: AUTH_BAR.MIN_H, justifyContent: 'center', alignItems: 'flex-start' },
    sideRight: { alignItems: 'flex-end' },
    heading: { gap: space.sm },
}));

export default AuthBar;
