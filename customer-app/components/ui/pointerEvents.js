/**
 * pointerEvents as STATIC styles. Use these (not an inline `{ pointerEvents: x ? 'box-none' : 'none' }`)
 * whenever the value changes at runtime: on web, react-native-web can't express 'box-none' inline,
 * so flipping an inline value from 'none' to 'box-none' leaves `pointer-events: none` stuck on the
 * element and everything inside stops taking taps (the dead-dock bug).
 *
 *   <Animated.View style={[styles.wrap, anim, shown ? pe.boxNone : pe.none]} />
 */
import { StyleSheet } from 'react-native';

export const pe = StyleSheet.create({
    auto: { pointerEvents: 'auto' },
    none: { pointerEvents: 'none' },
    boxNone: { pointerEvents: 'box-none' },
    boxOnly: { pointerEvents: 'box-only' },
});

export default pe;
