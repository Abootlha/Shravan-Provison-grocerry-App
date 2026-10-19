/**
 * WishlistToast — mounted once in App.js. Watches `wishlist.lastAddedTime` (set by
 * toggleWishlistItem when an item is added) and shows the design-system toast with an
 * "Undo" action (takes the item back out). It stays up long enough to read and act on.
 * Renders nothing itself.
 */
import { createElement, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleWishlistItem } from '../store/slices/wishlistSlice';
import { ORDER_STRIP_CLEARANCE } from './ActiveOrderBar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toast } from './ui';
import { space } from '../constants/theme';
import { useTheme } from '../theme';
import { useCartBarOffset } from './BottomTabsIcons';
import { useTranslation } from '../hooks/useTranslation';

/** Height of the night cart pill + a gap, so the toast stacks above it (and above Home's slim order strip). */
const CART_PILL_CLEARANCE = 56 + space.md + ORDER_STRIP_CLEARANCE;
const DURATION_MS = 5000;

export default function WishlistToast() {
    const lastAddedItem = useSelector((s) => s.wishlist?.lastAddedItem);
    const lastAddedTime = useSelector((s) => s.wishlist?.lastAddedTime);
    const cartHasItems = useSelector((s) => s.cart.totalItems > 0);
    const dispatch = useDispatch();
    const { colors, isDark } = useTheme();
    const { isHi } = useTranslation();
    const cartBarOffset = useCartBarOffset();
    const seen = useRef(lastAddedTime);

    useEffect(() => {
        // Skip the value present at mount (e.g. restored state) — only react to new adds.
        if (!lastAddedItem || !lastAddedTime || lastAddedTime === seen.current) return;
        seen.current = lastAddedTime;
        toast.show({
            message: isHi ? 'विशलिस्ट में जोड़ा गया' : 'Added to wishlist',
            description: lastAddedItem.name,
            // Stack above the floating cart pill (which sits above the dock) when it is showing.
            bottomOffset: cartHasItems ? cartBarOffset + CART_PILL_CLEARANCE : undefined,
            duration: DURATION_MS,
            // the toast is a night surface in both themes; errorInk is the red that reads on it in dark
            icon: createElement(MaterialCommunityIcons, { name: 'heart', size: 20, color: isDark ? colors.errorInk : colors.error }),
            action: {
                label: isHi ? 'वापस लें' : 'Undo',
                // toggling an item that's in the list takes it out again
                onPress: () => dispatch((d, getState) => {
                    if (getState().wishlist?.items?.some((i) => i.id === lastAddedItem.id)) d(toggleWishlistItem(lastAddedItem));
                }),
            },
        });
    }, [lastAddedItem, lastAddedTime, isHi, dispatch, cartHasItems, cartBarOffset, colors, isDark]);

    return null;
}
