import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import orderReducer from './slices/orderSlice';
import locationReducer from './slices/locationSlice';
import earningsReducer from './slices/earningsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    orders: orderReducer,
    location: locationReducer,
    earnings: earningsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
