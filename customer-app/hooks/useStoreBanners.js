/**
 * The store's own banners (Admin > Banners, GET /banners) for Home and Category screens.
 *
 *   const banners = useStoreBanners();                 // every live banner, store order
 *   const slides = toBannerSlides(banners, isHi);      // BannerCarousel items
 *   const openBanner = useOpenBanner(navigation, categories);
 *
 * Store banners are finished artwork (headline, offer and button are in the image), so slides
 * carry no `title`: the carousel would draw it over the artwork's own text. The title is kept as
 * the accessibility label. Banners refresh whenever the screen regains focus, so a banner the
 * store adds, ends or deletes shows up without restarting the app.
 */
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BannerService } from '../services';
import { describeError } from '../services/normalize';

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

export function useStoreBanners() {
    const [banners, setBanners] = useState([]);
    useFocusEffect(
        useCallback(() => {
            let active = true;
            BannerService.list()
                .then((list) => active && setBanners(list))
                .catch((err) => {
                    // Banners are extra: keep what we had; never block the screen.
                    if (__DEV__) console.warn('[banners] /banners unavailable', describeError(err));
                });
            return () => {
                active = false;
            };
        }, []),
    );
    return banners;
}

/** Banners aimed at one category (shown at the top of that category's screen). */
export const bannersForCategory = (banners, categoryId) =>
    banners.filter((b) => b.target?.type === 'category' && sameId(b.target.id, categoryId));

export const toBannerSlides = (banners, isHi) =>
    banners.map((b) => ({
        id: b.id,
        image: { uri: b.image },
        surface: 'neutral',
        accessibilityLabel: (isHi && b.titleHi) || b.title || undefined,
        target: b.target,
    }));

/**
 * Opens what a banner points at: a product, a category (looked up in `categories`), or an
 * https link. `currentCategoryId`: on that category's own screen a category banner does nothing.
 * Returns null when the banner has nowhere to go, so the carousel can render it non-pressable.
 */
export function useOpenBanner(navigation, categories = [], currentCategoryId = null) {
    return useCallback(
        (banner) => {
            const target = banner?.target;
            if (target?.type === 'product' && target.id) {
                navigation.navigate('ProductDetail', { product: { _id: target.id } });
                return;
            }
            if (target?.type === 'url' && /^https:\/\//i.test(target.url || '')) {
                Linking.openURL(target.url).catch(() => undefined);
                return;
            }
            if (target?.type === 'category' && target.id) {
                if (sameId(target.id, currentCategoryId)) return;
                const category = categories.find((c) => sameId(c?._id ?? c?.id, target.id));
                navigation.navigate('Category', { category: category || { _id: target.id } });
                return;
            }
            // Bundled fallback banners carry the category object directly.
            if (banner?.category) navigation.navigate('Category', { category: banner.category });
            else navigation.navigate('Categories');
        },
        [navigation, categories, currentCategoryId],
    );
}
