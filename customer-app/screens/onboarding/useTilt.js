/**
 * useTilt() -> { x, y } SharedValues in -1..1 from the gravity sensor (x: side-to-side roll; y stays 0),
 * for a subtle parallax on the onboarding hero. Built on reanimated's own sensor (no extra package), read on the UI thread.
 * Web, reduced motion, or no sensor: both stay 0 (static).
 */
import { Platform } from 'react-native';
import { SensorType, useAnimatedSensor, useDerivedValue, useReducedMotion, useSharedValue } from 'react-native-reanimated';

const clamp = (v) => {
    'worklet';
    return Math.max(-1, Math.min(1, v));
};

function useSensorTilt() {
    const reduce = useReducedMotion();
    const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 'auto' });
    const x = useDerivedValue(() => (reduce ? 0 : clamp(-(sensor.sensor.value.x || 0) / 6)));
    // only the side-to-side roll: how upright people hold the phone varies too much for a y baseline
    const y = useSharedValue(0);
    return { x, y };
}

function useStillTilt() {
    const x = useSharedValue(0);
    const y = useSharedValue(0);
    return { x, y };
}

// Chosen once per platform, so the hook order never changes.
export const useTilt = Platform.OS === 'web' ? useStillTilt : useSensorTilt;

export default useTilt;
