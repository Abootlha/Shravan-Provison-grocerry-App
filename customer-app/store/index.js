import { configureStore } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import cartReducer, { hydrateCart } from './slices/cartSlice';
import authReducer from './slices/authSlice';
import locationReducer from './slices/locationSlice';
import languageReducer from './slices/languageSlice';
import orderTrackingReducer from './slices/orderTrackingSlice';
import wishlistReducer from './slices/wishlistSlice';

export const CART_STORAGE_KEY = 'customerCart';

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

export default store;
