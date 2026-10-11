/**
 * useTabBarScroll — a Reanimated scroll handler that tracks the offset on the UI thread
 * (`scrollY`) and hides the bottom tab bar while scrolling down / shows it on the way up.
 * It only crosses to JS when the direction flips, never per frame.
 * Also re-shows the tab bar whenever the screen gains focus.
 * Returns { scrollY, onScroll, reveal } — call reveal() when the list is swapped / reset to the top.
 */
import { useCallback, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { runOnJS, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

export function useTabBarScroll(navigation) {
    const scrollY = useSharedValue(0);
    const lastY = useSharedValue(0);
    const shown = useSharedValue(1);

    const setVisible = useCallback((visible) => DeviceEventEmitter.emit('SET_TAB_BAR_VISIBLE', visible), []);

    useEffect(() => {
        if (!navigation) return undefined;
        const unsubscribe = navigation.addListener('focus', () => {
            shown.value = 1;
            setVisible(true);
        });
        setVisible(true);
        return unsubscribe;
    }, [navigation, setVisible]);

    const onScroll = useAnimatedScrollHandler({
        onScroll: (e) => {
            const y = e.contentOffset.y;
            scrollY.value = y;
            const dy = y - lastY.value;
            lastY.value = y;
            if (dy > 6 && y > 120 && shown.value === 1) {
                shown.value = 0;
                runOnJS(setVisible)(false);
            } else if ((dy < -6 || y <= 0) && shown.value === 0) {
                shown.value = 1;
                runOnJS(setVisible)(true);
            }
        },
    });

    const reveal = useCallback(() => {
        lastY.value = 0;
        shown.value = 1;
        setVisible(true);
    }, [setVisible]);

    return { scrollY, onScroll, reveal };
}
