import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiErrorMessage, apiErrorStatus, mergeOrder, orderApi } from '../../services/api';
import { storage } from '../../services/storage';
import { locationService } from '../../services/location';
import type { EndedOrder, Order, OrderStatus } from '../../types/order';

/** Statuses in which an order is this rider's job (accepted, not finished). */
export const ACTIVE_STATUSES: OrderStatus[] = ['assigned', 'packed', 'picked_up', 'out_for_delivery'];

interface OrderState {
  currentOrder: Order | null;
  /** Orders reserved for me that I have not accepted yet (status CONFIRMED). */
  offers: Order[];
  /** When each offer was first seen on this device, for the accept countdown. */
  offerSeenAt: Record<string, number>;
  /**
   * Offers whose countdown ran out on this device. Nothing is sent to the
   * server (a missed alert must not count as a rejection); the store or the
   * admin reassigns, and orderUnassigned then removes the offer.
   */
  expiredOfferIds: Record<string, true>;
  /** Orders taken away while the rider may still be looking at them. */
  ended: Record<string, EndedOrder>;
  offersLoading: boolean;
  currentLoading: boolean;
  /** True once /orders/current answered at least once this session. */
  currentLoaded: boolean;
  /** Last load error (shown with a retry), cleared on success. */
  loadError: string | null;
  /** Order id with an accept/reject/status request in flight. */
  pendingOrderId: string | null;
}

const initialState: OrderState = {
  currentOrder: null,
  offers: [],
  offerSeenAt: {},
  expiredOfferIds: {},
  ended: {},
  offersLoading: false,
  currentLoading: false,
  currentLoaded: false,
  loadError: null,
  pendingOrderId: null,
};

export type ThunkError = { message: string; status: number | null };
const toThunkError = (error: unknown, fallback: string): ThunkError => ({
  message: apiErrorMessage(error, fallback),
  status: apiErrorStatus(error),
});

export const fetchOffers = createAsyncThunk<Order[], void, { rejectValue: ThunkError }>(
  'orders/fetchOffers',
  async (_, { rejectWithValue }) => {
    try {
      return (await orderApi.getAvailable()).filter((order) => order.status === 'confirmed');
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not load order requests.'));
    }
  }
);

export const fetchCurrentOrder = createAsyncThunk<
  { order: Order | null; fromCache: boolean },
  void,
  { rejectValue: ThunkError }
>('orders/fetchCurrent', async (_, { rejectWithValue }) => {
  try {
    const order = await orderApi.getCurrent();
    return { order, fromCache: false };
  } catch (error) {
    // Offline: keep showing the last known active order instead of nothing.
    if (apiErrorStatus(error) === null) {
      const cached = await storage.getActiveOrder<Order>();
      if (cached) return { order: cached, fromCache: true };
    }
    return rejectWithValue(toThunkError(error, 'Could not load your active order.'));
  }
});

export const refreshOrder = createAsyncThunk<Order, string, { rejectValue: ThunkError }>(
  'orders/refresh',
  async (orderId, { rejectWithValue }) => {
    try {
      return await orderApi.getById(orderId);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not load this order.'));
    }
  }
);

export const acceptOffer = createAsyncThunk<Order, string, { rejectValue: ThunkError }>(
  'orders/accept',
  async (orderId, { rejectWithValue }) => {
    try {
      return await orderApi.accept(orderId);
    } catch (error) {
      return rejectWithValue(toThunkError(error, 'Could not accept this order.'));
    }
  }
);

export const rejectOrder = createAsyncThunk<
  { orderId: string; reassigned: boolean },
  { orderId: string; reason?: string },
  { rejectValue: ThunkError }
>('orders/reject', async ({ orderId, reason }, { rejectWithValue }) => {
  try {
    const { reassigned } = await orderApi.reject(orderId, reason);
    return { orderId, reassigned };
  } catch (error) {
    return rejectWithValue(toThunkError(error, 'Could not decline this order.'));
  }
});

export const updateOrderStatus = createAsyncThunk<
  Order,
  { orderId: string; status: OrderStatus; deliveryOtp?: string },
  { rejectValue: ThunkError }
>('orders/updateStatus', async ({ orderId, status, deliveryOtp }, { rejectWithValue }) => {
  try {
    // Proof of location for pickup / delivery comes from the single live fix.
    const fix = locationService.latest;
    const fresh = fix && Date.now() - fix.timestamp < 2 * 60 * 1000 ? fix : null;
    return await orderApi.updateStatus(orderId, status, {
      deliveryOtp,
      location: fresh ? { latitude: fresh.latitude, longitude: fresh.longitude, accuracy: fresh.accuracy } : null,
    });
  } catch (error) {
    return rejectWithValue(toThunkError(error, 'Could not update the order. Please try again.'));
  }
});

const removeOffer = (state: OrderState, orderId: string) => {
  state.offers = state.offers.filter((order) => order.id !== orderId);
  delete state.offerSeenAt[orderId];
  delete state.expiredOfferIds[orderId];
};

const applyOrder = (state: OrderState, order: Order) => {
  if (order.status === 'confirmed') {
    // Still (or again) an offer: only keep it if it is not my active job.
    if (state.currentOrder?.id === order.id) state.currentOrder = null;
    delete state.ended[order.id];
    const index = state.offers.findIndex((offer) => offer.id === order.id);
    if (index >= 0) {
      state.offers[index] = mergeOrder(state.offers[index], order);
    } else {
      state.offers.unshift(order);
      state.offerSeenAt[order.id] = state.offerSeenAt[order.id] ?? Date.now();
    }
    return;
  }

  removeOffer(state, order.id);
  if (ACTIVE_STATUSES.includes(order.status)) {
    state.currentOrder = mergeOrder(state.currentOrder, order);
    delete state.ended[order.id];
  } else if (state.currentOrder?.id === order.id) {
    // Delivered or cancelled.
    state.currentOrder = null;
  }
};

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    /** Any fresh order payload from the socket. */
    orderReceived: (state, action: PayloadAction<Order>) => {
      applyOrder(state, action.payload);
    },
    orderEnded: (state, action: PayloadAction<EndedOrder>) => {
      const ended = action.payload;
      removeOffer(state, ended.orderId);
      if (state.currentOrder?.id === ended.orderId) state.currentOrder = null;
      state.ended[ended.orderId] = ended;
    },
    offerExpired: (state, action: PayloadAction<string>) => {
      if (state.offers.some((offer) => offer.id === action.payload)) state.expiredOfferIds[action.payload] = true;
    },
    /** Hide an expired offer from this device only. */
    dismissOffer: (state, action: PayloadAction<string>) => {
      removeOffer(state, action.payload);
    },
    dismissEnded: (state, action: PayloadAction<string>) => {
      delete state.ended[action.payload];
    },
    resetOrders: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOffers.pending, (state) => {
        state.offersLoading = true;
      })
      .addCase(fetchOffers.fulfilled, (state, action) => {
        state.offersLoading = false;
        state.loadError = null;
        const now = Date.now();
        const seen: Record<string, number> = {};
        for (const order of action.payload) seen[order.id] = state.offerSeenAt[order.id] ?? now;
        state.offers = action.payload.map((order) =>
          mergeOrder(
            state.offers.find((offer) => offer.id === order.id),
            order
          )
        );
        state.offerSeenAt = seen;
        const expired: Record<string, true> = {};
        for (const order of action.payload) if (state.expiredOfferIds[order.id]) expired[order.id] = true;
        state.expiredOfferIds = expired;
      })
      .addCase(fetchOffers.rejected, (state, action) => {
        state.offersLoading = false;
        state.loadError = action.payload?.message ?? 'Could not load order requests.';
      })
      .addCase(fetchCurrentOrder.pending, (state) => {
        state.currentLoading = true;
      })
      .addCase(fetchCurrentOrder.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.loadError = action.payload.fromCache ? 'Offline. Showing your last saved order.' : null;
        const order = action.payload.order;
        state.currentOrder = order ? mergeOrder(state.currentOrder, order) : null;
        if (order) removeOffer(state, order.id);
      })
      .addCase(fetchCurrentOrder.rejected, (state, action) => {
        state.currentLoading = false;
        state.currentLoaded = true;
        state.loadError = action.payload?.message ?? 'Could not load your active order.';
      })
      .addCase(refreshOrder.fulfilled, (state, action) => {
        const order = action.payload;
        if (state.currentOrder?.id === order.id || state.offers.some((offer) => offer.id === order.id)) {
          applyOrder(state, order);
        }
      })
      .addCase(refreshOrder.rejected, (state, action) => {
        // 403: the order is no longer mine (reassigned while offline).
        const orderId = action.meta.arg;
        if (action.payload?.status === 403 && state.currentOrder?.id === orderId) {
          state.currentOrder = null;
          state.ended[orderId] = {
            orderId,
            kind: 'unassigned',
            reason: null,
            self: false,
            at: new Date().toISOString(),
          };
        }
      })
      .addCase(acceptOffer.pending, (state, action) => {
        state.pendingOrderId = action.meta.arg;
      })
      .addCase(acceptOffer.fulfilled, (state, action) => {
        state.pendingOrderId = null;
        applyOrder(state, action.payload);
      })
      .addCase(acceptOffer.rejected, (state, action) => {
        state.pendingOrderId = null;
        // Offer gone (taken back, cancelled): drop it so the card disappears.
        if (action.payload && [400, 403, 404, 409].includes(action.payload.status ?? 0)) {
          removeOffer(state, action.meta.arg);
        }
      })
      .addCase(rejectOrder.pending, (state, action) => {
        state.pendingOrderId = action.meta.arg.orderId;
      })
      .addCase(rejectOrder.fulfilled, (state, action) => {
        state.pendingOrderId = null;
        const { orderId } = action.payload;
        removeOffer(state, orderId);
        if (state.currentOrder?.id === orderId) state.currentOrder = null;
        state.ended[orderId] = {
          orderId,
          kind: 'unassigned',
          reason: action.meta.arg.reason ?? null,
          self: true,
          at: new Date().toISOString(),
        };
      })
      .addCase(rejectOrder.rejected, (state, action) => {
        state.pendingOrderId = null;
        if (action.payload?.status === 403) removeOffer(state, action.meta.arg.orderId);
      })
      .addCase(updateOrderStatus.pending, (state, action) => {
        state.pendingOrderId = action.meta.arg.orderId;
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        state.pendingOrderId = null;
        applyOrder(state, action.payload);
      })
      .addCase(updateOrderStatus.rejected, (state) => {
        state.pendingOrderId = null;
      });
  },
});

export const { orderReceived, orderEnded, offerExpired, dismissOffer, dismissEnded, resetOrders } = orderSlice.actions;

export default orderSlice.reducer;
