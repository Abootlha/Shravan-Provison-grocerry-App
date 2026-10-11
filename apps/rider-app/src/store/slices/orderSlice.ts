import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { orderApi } from '../../services/api';
import { storage } from '../../services/storage';
import type { Order, AvailableOrder, OrderStatus } from '../../types/order';

interface OrderState {
  currentOrder: Order | null;
  availableOrders: AvailableOrder[];
  loading: boolean;
  error: string | null;
}

const initialState: OrderState = {
  currentOrder: null,
  availableOrders: [],
  loading: false,
  error: null,
};

export const fetchAvailableOrders = createAsyncThunk(
  'orders/fetchAvailable',
  async (_, { rejectWithValue }) => {
    try {
      return await orderApi.getAvailable() as AvailableOrder[];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue((error.response?.data as any)?.message || 'Failed to fetch available orders');
      }
      return rejectWithValue('Failed to fetch available orders');
    }
  }
);

export const hydrateCurrentOrder = createAsyncThunk(
  'orders/hydrateCurrent',
  async (_, { rejectWithValue }) => {
    try {
      const persisted = await storage.getActiveOrder<Order>();
      const latest = await orderApi.getCurrent();
      const order = latest || persisted;

      if (!order) {
        await storage.clearActiveOrder();
        return null;
      }

      await storage.setActiveOrder(order);
      return order;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue((error.response?.data as any)?.message || 'Failed to load current order');
      }
      return rejectWithValue('Failed to load current order');
    }
  }
);

export const acceptOrder = createAsyncThunk(
  'orders/accept',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const response = await orderApi.accept(orderId);
      return response.order as Order;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue((error.response?.data as any)?.message || 'Failed to accept order');
      }
      return rejectWithValue('Failed to accept order');
    }
  }
);

export const rejectOrder = createAsyncThunk(
  'orders/reject',
  async (orderId: string, { rejectWithValue }) => {
    try {
      await orderApi.reject(orderId);
      return orderId;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue((error.response?.data as any)?.message || 'Failed to reject order');
      }
      return rejectWithValue('Failed to reject order');
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async (
    {
      orderId,
      status,
      location,
      deliveryOtp,
    }: {
      orderId: string;
      status: OrderStatus;
      location?: { latitude: number; longitude: number };
      deliveryOtp?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await orderApi.updateStatus(orderId, status, location, deliveryOtp);
      return response.order as Order;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return rejectWithValue((error.response?.data as any)?.message || 'Failed to update order status');
      }
      return rejectWithValue('Failed to update order status');
    }
  }
);

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentOrder: (state, action: PayloadAction<Order | null>) => {
      state.currentOrder = action.payload;
      if (action.payload) {
        storage.setActiveOrder(action.payload).catch(() => undefined);
      } else {
        storage.clearActiveOrder().catch(() => undefined);
      }
    },
    addAvailableOrder: (state, action: PayloadAction<AvailableOrder>) => {
      const exists = state.availableOrders.find((o) => o.id === action.payload.id);
      if (!exists) {
        state.availableOrders.unshift(action.payload);
      }
    },
    removeAvailableOrder: (state, action: PayloadAction<string>) => {
      state.availableOrders = state.availableOrders.filter((o) => o.id !== action.payload);
    },
    clearAvailableOrders: (state) => {
      state.availableOrders = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAvailableOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAvailableOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.availableOrders = action.payload;
      })
      .addCase(fetchAvailableOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(hydrateCurrentOrder.fulfilled, (state, action) => {
        state.currentOrder = action.payload;
      })
      .addCase(hydrateCurrentOrder.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(acceptOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(acceptOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.currentOrder = action.payload;
        state.availableOrders = state.availableOrders.filter((o) => o.id !== action.payload.id);
        storage.setActiveOrder(action.payload).catch(() => undefined);
      })
      .addCase(acceptOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(rejectOrder.fulfilled, (state, action) => {
        state.availableOrders = state.availableOrders.filter((o) => o.id !== action.payload);
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        state.currentOrder = action.payload;
        state.error = null;
        if (action.payload.status === 'delivered' || action.payload.status === 'cancelled') {
          storage.clearActiveOrder().catch(() => undefined);
        } else {
          storage.setActiveOrder(action.payload).catch(() => undefined);
        }
      })
      .addCase(updateOrderStatus.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  clearError,
  setCurrentOrder,
  addAvailableOrder,
  removeAvailableOrder,
  clearAvailableOrders,
} = orderSlice.actions;

export default orderSlice.reducer;
