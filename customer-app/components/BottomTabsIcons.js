/**
 * Bottom navigation helpers for the floating dock (Part C #3).
 *
 *   TAB_GLYPHS          outline / filled MaterialCommunityIcons per tab route
 *   dockIcon(name)      icon renderer for FloatingDock items (filled glyph when focused)
 *   useDockInset()      the `bottomInset` the dock is rendered with on this device
 *   useTabBarHeight()   distance from the screen bottom to the dock's top edge — pad scroll
 *                       content by at least this so the last row can scroll clear of the dock
 *   useCartBarOffset()  `bottomOffset` for FloatingCartBar / ActiveOrderBar on tab screens:
 *                       just above the dock
 *
 *   useTabBarScroll(navigation)  -> { scrollY, onScroll }: Reanimated scroll handler for any tab
 *                       screen's list; hides the dock on scroll-down, shows it on scroll-up/focus
 *
 * The dock floats 12pt above the safe-area inset; on devices with a home indicator we tuck it
 * 8pt into the inset so it doesn't ride too high.
 */
import React, { useRef } from 'react';
import Animated from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DOCK_HEIGHT, useCartTarget } from './ui';
import { space } from '../constants/theme';

/** @deprecated kept for old imports — the dock's own height (64). */
export const TAB_BAR_HEIGHT = DOCK_HEIGHT;

/** `bottomInset` for FloatingDock on this device. */
export function useDockInset() {
    const { bottom } = useSafeAreaInsets();
    return Math.max(bottom - space.sm, 0);
}

/** Screen bottom → dock top edge, including the safe area and the dock's own lift. */
export function useTabBarHeight() {
    return useDockInset() + space.md + DOCK_HEIGHT;
}

/** `bottomOffset` for FloatingCartBar on tab screens: sits just above the dock. */
export function useCartBarOffset() {
    return useTabBarHeight() + space.sm;
}

export const TAB_GLYPHS = {
    Home: ['home-variant-outline', 'home-variant'],
    Categories: ['view-grid-outline', 'view-grid'],
    Search: ['magnify', 'text-search'],
    Cart: ['shopping-outline', 'shopping'],
    Account: ['account-outline', 'account'],
};

/**
 * The dock's cart glyph is a fly-to-cart target (priority 2: used when the cart pill isn't on
 * screen). It bumps on landing; the gold count badge rolls via useFlightDeferred in FloatingDock.
 */
function CartDockGlyph({ color, size, focused }) {
    const ref = useRef(null);
    const bump = useCartTarget(ref, { priority: 2 });
    const [outline, filled] = TAB_GLYPHS.Cart;
    return (
        <Animated.View ref={ref} collapsable={false} style={bump}>
            <MaterialCommunityIcons name={focused ? filled : outline} color={color} size={size} />
        </Animated.View>
    );
}

// FloatingDock calls `icon(...)` as a plain function, so hooks must live in a real element.
const renderCartGlyph = (props) => <CartDockGlyph {...props} />;

/** FloatingDock `icon` renderer for a tab route. */
export const dockIcon = (name) => {
    if (name === 'Cart') return renderCartGlyph;
    const [outline, filled] = TAB_GLYPHS[name] || ['circle-outline', 'circle'];
    const DockGlyph = ({ color, size, focused }) => <MaterialCommunityIcons name={focused ? filled : outline} color={color} size={size} />;
    return DockGlyph;
};

export default dockIcon;

/** Scroll handler that hides the dock on scroll-down / shows it on scroll-up (emits SET_TAB_BAR_VISIBLE). */
export { useTabBarScroll } from '../screens/home/useTabBarScroll';
