import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { orderApi } from '../../services/api';
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
    } catch {
      return rejectWithValue('Failed to fetch available orders');
    }
  }
);

export const acceptOrder = createAsyncThunk(
  'orders/accept',
  async (orderId: string, { rejectWithValue }) => {
    try {
      const response = await orderApi.accept(orderId);
      return response.order as Order;
    } catch {
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
    } catch {
      return rejectWithValue('Failed to reject order');
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async (
    { orderId, status, location }: { orderId: string; status: OrderStatus; location?: { latitude: number; longitude: number } },
    { rejectWithValue }
  ) => {
    try {
      const response = await orderApi.updateStatus(orderId, status, location);
      return response.order as Order;
    } catch {
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
      .addCase(acceptOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(acceptOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.currentOrder = action.payload;
        state.availableOrders = state.availableOrders.filter((o) => o.id !== action.payload.id);
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
