import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './slices/cartSlice';
import authReducer from './slices/authSlice';
import locationReducer from './slices/locationSlice';
import languageReducer from './slices/languageSlice';

export const store = configureStore({
    reducer: {
        cart: cartReducer,
        auth: authReducer,
        location: locationReducer,
        language: languageReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});

export default store;
