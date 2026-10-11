/**
 * WishlistToast — mounted once in App.js. Watches `wishlist.lastAddedTime` (set by
 * toggleWishlistItem when an item is added) and shows the design-system toast with a
 * "View" action that opens the Wishlist. Renders nothing itself.
 */
import { createElement, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toast } from './ui';
import { space } from '../constants/theme';
import { useTheme } from '../theme';
import { useCartBarOffset } from './BottomTabsIcons';
import { useTranslation } from '../hooks/useTranslation';

/** Height of the night cart pill + a gap, so the toast stacks above it. */
const CART_PILL_CLEARANCE = 56 + space.md;

export default function WishlistToast() {
    const lastAddedItem = useSelector((s) => s.wishlist?.lastAddedItem);
    const lastAddedTime = useSelector((s) => s.wishlist?.lastAddedTime);
    const cartHasItems = useSelector((s) => s.cart.totalItems > 0);
    const navigation = useNavigation();
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
            // the toast is a night surface in both themes; errorInk is the red that reads on it in dark
            icon: createElement(MaterialCommunityIcons, { name: 'heart', size: 20, color: isDark ? colors.errorInk : colors.error }),
            action: {
                label: isHi ? 'देखें' : 'View',
                onPress: () => navigation.navigate('Wishlist'),
            },
        });
    }, [lastAddedItem, lastAddedTime, isHi, navigation, cartHasItems, cartBarOffset, colors, isDark]);

    return null;
}
