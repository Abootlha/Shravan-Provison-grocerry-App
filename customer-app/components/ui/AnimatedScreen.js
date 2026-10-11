/**
 * useScreenEnter / AnimatedScreen — the subtle "content arrives" beat for a screen body:
 * opacity 0 → 1 (220ms ease-out) + an 8px rise on a gentle spring. Once per mount by default;
 * `replayOnFocus` replays a shorter 150ms version when a TAB screen comes back after a genuine tab
 * switch (tabs crossfade instead of sliding — motion-spec "Global"). Returning from a pushed stack
 * screen (PDP, settings…) does NOT replay: the pop / hero flight already carries that moment
 * (same rule as screens/home/useTabEnter).
 *
 * useScreenEnter(options?) → animated style for an Animated.View
 *   options.offsetY        rise distance (default 8)
 *   options.delay          ms before starting (default 0)
 *   options.replayOnFocus  replay after a tab switch back to this screen (tab screens) (default false)
 *   options.disabled       render static (e.g. returning to a restored screen)
 *
 * <AnimatedScreen style replayOnFocus offsetY delay>{body}</AnimatedScreen>
 *   A flex:1 Animated.View. Put it INSIDE <Screen> (the background/status bar never animate, only
 *   the content does). Never blocks touches: content is interactive from frame one.
 *
 * Reduced motion: opacity only.
 *
 * Example
 *   <Screen>
 *     <AnimatedScreen>
 *       <Header /> <FlashList … />
 *     </AnimatedScreen>
 *   </Screen>
 */
import React, { useContext, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { springs, durations, easings } from '../../theme/motion';

export function useScreenEnter({ offsetY = 8, delay = 0, replayOnFocus = false, disabled = false } = {}) {
    const reduce = useReducedMotion();
    const navigation = useContext(NavigationContext);
    const route = useContext(NavigationRouteContext);
    const o = useSharedValue(disabled ? 1 : 0);
    const y = useSharedValue(disabled || reduce ? 0 : offsetY);

    useEffect(() => {
        if (disabled) return undefined;
        const play = (first) => {
            const dur = first ? durations.base : durations.fast - 10; // 220 first paint, 150 on tab return
            o.value = first ? 0 : 0.35; // tab return: a soft crossfade, never a blank frame
            o.value = withDelay(first ? delay : 0, withTiming(1, { duration: dur, easing: easings.out }));
            if (!reduce) {
                y.value = offsetY;
                y.value = withDelay(first ? delay : 0, withSpring(0, springs.gentle));
            }
        };
        play(true);
        if (!replayOnFocus || !navigation) return undefined;
        // Replay only when we lost focus to a SIBLING TAB. On blur the owning navigator's state is
        // already updated: if it is a tab navigator and another route is now focused, it was a tab
        // switch. A stack screen pushed above the tabs leaves our tab focused → no replay on return.
        let blurred = false;
        const offBlur = navigation.addListener('blur', () => {
            const s = navigation.getState?.();
            const focusedKey = s?.routes?.[s.index]?.key;
            blurred = s?.type === 'tab' && !!route && focusedKey !== route.key;
        });
        const offFocus = navigation.addListener('focus', () => {
            if (blurred) play(false);
            blurred = false;
        });
        return () => {
            offBlur();
            offFocus();
        };
    }, [disabled, replayOnFocus, reduce]);

    return useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
}

export function AnimatedScreen({ style, children, offsetY, delay, replayOnFocus, disabled, ...rest }) {
    const anim = useScreenEnter({ offsetY, delay, replayOnFocus, disabled });
    return (
        <Animated.View style={[styles.fill, style, anim]} {...rest}>
            {children}
        </Animated.View>
    );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

export default AnimatedScreen;
