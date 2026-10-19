import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import cartReducer, { hydrateCart } from './slices/cartSlice';
import authReducer from './slices/authSlice';
import locationReducer from './slices/locationSlice';
import languageReducer from './slices/languageSlice';
import orderTrackingReducer from './slices/orderTrackingSlice';
import wishlistReducer, { hydrateWishlist } from './slices/wishlistSlice';

export const CART_STORAGE_KEY = 'customerCart';
export const WISHLIST_STORAGE_KEY = 'customerWishlist';

export const store = configureStore({
    reducer: {
        cart: cartReducer,
        auth: authReducer,
        location: locationReducer,
        language: languageReducer,
        orderTracking: orderTrackingReducer,
        wishlist: wishlistReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});

// --- Cart persistence (local only; no server sync) ---
let cartHydrated = false;
let lastSavedCart = null;
let saveTimer = null;

const hydrateCartFromStorage = async () => {
    try {
        const saved = await AsyncStorage.getItem(CART_STORAGE_KEY);
        // Don't clobber items the user added while storage was loading.
        if (saved && store.getState().cart.items.length === 0) {
            store.dispatch(hydrateCart(JSON.parse(saved)));
        }
    } catch (error) {
        if (__DEV__) console.warn('Failed to restore cart:', error?.message);
    } finally {
        cartHydrated = true;
        lastSavedCart = store.getState().cart;
    }
};

store.subscribe(() => {
    const cart = store.getState().cart;
    if (!cartHydrated || cart === lastSavedCart) return;
    lastSavedCart = cart;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items: cart.items })).catch(() => undefined);
    }, 300);
});

hydrateCartFromStorage();

// --- Wishlist persistence (this phone only, like the cart) ---
let wishlistHydrated = false;
let lastSavedWishlist = null;
let wishlistTimer = null;

const hydrateWishlistFromStorage = async () => {
    try {
        const saved = await AsyncStorage.getItem(WISHLIST_STORAGE_KEY);
        if (saved && store.getState().wishlist.items.length === 0) {
            store.dispatch(hydrateWishlist(JSON.parse(saved)));
        }
    } catch (error) {
        if (__DEV__) console.warn('Failed to restore wishlist:', error?.message);
    } finally {
        wishlistHydrated = true;
        lastSavedWishlist = store.getState().wishlist.items;
    }
};

store.subscribe(() => {
    const items = store.getState().wishlist.items;
    if (!wishlistHydrated || items === lastSavedWishlist) return;
    lastSavedWishlist = items;

    clearTimeout(wishlistTimer);
    wishlistTimer = setTimeout(() => {
        AsyncStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify({ items })).catch(() => undefined);
    }, 300);
});

hydrateWishlistFromStorage();

export default store;
