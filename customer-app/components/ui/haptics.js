/**
 * Thin, safe wrapper over expo-haptics. No-ops on web and swallows errors
 * (e.g. devices without a Taptic engine), so call sites never need guards.
 *
 *   import { haptic } from '../components/ui';
 *   haptic.light();      // ADD / stepper / chip toggles
 *   haptic.selection();  // scrubbing, crossing a threshold, picker ticks
 *   haptic.medium();     // primary CTA confirmations, sheet snap
 *   haptic.success();    // order placed, payment done
 *   haptic.warning();    // hit a limit (max quantity)
 *   haptic.error();      // failed action
 *   haptic('light')      // same, by name (used by the `haptic` prop on primitives)
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';
const safe = (fn) => () => {
    if (!enabled) return;
    try {
        fn().catch(() => {});
    } catch (e) {
        // ignore
    }
};

const map = {
    light: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    medium: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
    heavy: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
    selection: safe(() => Haptics.selectionAsync()),
    success: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    warning: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    error: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export function haptic(kind = 'light') {
    if (!kind) return;
    (map[kind] || map.light)();
}
Object.assign(haptic, map);

export default haptic;
