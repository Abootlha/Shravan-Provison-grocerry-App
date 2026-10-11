/**
 * useKeyboardSpring / KeyboardLift — make footers, sticky CTAs and forms ride the keyboard on the
 * UI thread (no KeyboardAvoidingView jump, no JS-thread layout).
 *
 * useKeyboardSpring({ offset }) → { height, liftStyle }
 *   height     SharedValue<number> — keyboard height in px, frame-synced with the OS animation
 *              (native: Reanimated useAnimatedKeyboard; web: visualViewport, springed)
 *   liftStyle  animated style: translateY = -max(0, height - offset)
 *   offset     px the keyboard may cover for free — pass the bottom safe-area inset for a footer
 *              that already sits above the home indicator (default 0)
 *
 * <KeyboardLift offset style>{footer}</KeyboardLift> — an Animated.View with liftStyle applied.
 *
 * BottomSheet already lifts itself; use this for screen footers (Checkout CTA, AddAddress save,
 * Login/OTP continue) and inline forms. For a ScrollView form, also add
 * `automaticallyAdjustKeyboardInsets` (iOS) / keyboardShouldPersistTaps="handled".
 *
 * Example
 *   const insets = useSafeAreaInsets();
 *   <KeyboardLift offset={insets.bottom} style={styles.footer}>
 *     <Button label="Save address" fullWidth onPress={save} />
 *   </KeyboardLift>
 */
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { springs } from '../../theme/motion';

function useKeyboardHeightNative() {
    return useAnimatedKeyboard().height;
}

function useKeyboardHeightWeb() {
    const h = useSharedValue(0);
    useEffect(() => {
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        if (!vv) return undefined;
        const update = () => {
            const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            h.value = withSpring(kb > 80 ? kb : 0, springs.sheet); // ignore URL-bar wobble
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, []);
    return h;
}

// Platform.OS never changes at runtime, so picking the hook once is hook-safe.
const useKeyboardHeight = Platform.OS === 'web' ? useKeyboardHeightWeb : useKeyboardHeightNative;

export function useKeyboardSpring({ offset = 0 } = {}) {
    const height = useKeyboardHeight();
    const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, height.value - offset) }] }));
    return { height, liftStyle };
}

export function KeyboardLift({ offset, style, children, ...rest }) {
    const { liftStyle } = useKeyboardSpring({ offset });
    return (
        <Animated.View style={[style, liftStyle]} {...rest}>
            {children}
        </Animated.View>
    );
}

export default useKeyboardSpring;
