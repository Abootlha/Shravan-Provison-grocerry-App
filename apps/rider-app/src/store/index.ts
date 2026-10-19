import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import orderReducer from './slices/orderSlice';
import locationReducer from './slices/locationSlice';
import metricsReducer from './slices/metricsSlice';
import { storage } from '../services/storage';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    orders: orderReducer,
    location: locationReducer,
    metrics: metricsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Persist the active order so it survives a restart while offline.
let persistedOrder: unknown = null;
store.subscribe(() => {
  const { currentOrder } = store.getState().orders;
  if (currentOrder === persistedOrder) return;
  persistedOrder = currentOrder;
  (currentOrder ? storage.setActiveOrder(currentOrder) : storage.clearActiveOrder()).catch(() => undefined);
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
