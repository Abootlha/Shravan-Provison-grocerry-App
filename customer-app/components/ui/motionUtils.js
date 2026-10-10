/**
 * Shared helpers for the signature-motion overlays (FlyToCart, HeroTransition).
 *
 *   measureRectSync(ref)   rect | null — web only (DOM getBoundingClientRect), null on native
 *   measureRect(ref)       Promise<{ x, y, width, height } | null> in window coordinates
 *                          (measureInWindow; RN-web implements it with getBoundingClientRect)
 *   insetRect(rect, frac)  shrink a rect by `frac` of its size on every side (ProductImage insets)
 *   onScreen(rect, win)    true when any part of the rect is inside the window
 *   useLatestFocus()       () => boolean — is the screen this component lives in focused?
 *                          Safe outside a navigator (always true there).
 */
import { useCallback, useContext } from 'react';
import { NavigationContext } from '@react-navigation/native';

/**
 * Synchronous measure where the platform allows it (web: the ref is a DOM node). Needed when the
 * view is about to be hidden — e.g. the card screen right after navigate() on web.
 */
export function measureRectSync(ref) {
    const node = ref && ref.current;
    if (!node || typeof node.getBoundingClientRect !== 'function') return null;
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: r.left, y: r.top, width: r.width, height: r.height };
}

export function measureRect(ref) {
    const sync = measureRectSync(ref);
    if (sync) return Promise.resolve(sync);
    return new Promise((resolve) => {
        const node = ref && ref.current;
        if (!node || typeof node.measureInWindow !== 'function') {
            resolve(null);
            return;
        }
        let settled = false;
        const done = (r) => {
            if (settled) return;
            settled = true;
            resolve(r);
        };
        try {
            node.measureInWindow((x, y, width, height) => {
                if (!width || !height || Number.isNaN(x) || Number.isNaN(y)) done(null);
                else done({ x, y, width, height });
            });
        } catch (e) {
            done(null);
        }
        // A detached view never calls back on some platforms: don't hang the caller.
        setTimeout(() => done(null), 250);
    });
}

export function insetRect(rect, frac = 0) {
    if (!rect) return null;
    const dx = rect.width * frac;
    const dy = rect.height * frac;
    return { x: rect.x + dx, y: rect.y + dy, width: rect.width - dx * 2, height: rect.height - dy * 2 };
}

export function onScreen(rect, win) {
    if (!rect) return false;
    return rect.x + rect.width > 0 && rect.y + rect.height > 0 && rect.x < win.width && rect.y < win.height;
}

export function useLatestFocus() {
    const navigation = useContext(NavigationContext);
    return useCallback(() => {
        try {
            return navigation ? navigation.isFocused() : true;
        } catch (e) {
            return true;
        }
    }, [navigation]);
}
