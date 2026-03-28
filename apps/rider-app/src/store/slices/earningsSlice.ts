import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { riderApi } from '../../services/api';

interface EarningsStats {
  deliveries: number;
  rating: number;
  acceptanceRate: number;
}

interface EarningsState {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  stats: EarningsStats;
  loading: boolean;
  error: string | null;
}

const initialState: EarningsState = {
  todayEarnings: 0,
  weekEarnings: 0,
  monthEarnings: 0,
  stats: {
    deliveries: 0,
    rating: 0,
    acceptanceRate: 0,
  },
  loading: false,
  error: null,
};

export const fetchEarnings = createAsyncThunk(
  'earnings/fetch',
  async (period: 'daily' | 'weekly' | 'monthly' = 'daily', { rejectWithValue }) => {
    try {
      return await riderApi.getEarnings(period);
    } catch {
      return rejectWithValue('Failed to fetch earnings');
    }
  }
);

const earningsSlice = createSlice({
  name: 'earnings',
  initialState,
  reducers: {
    clearEarnings: (state) => {
      state.todayEarnings = 0;
      state.weekEarnings = 0;
      state.monthEarnings = 0;
      state.stats = { deliveries: 0, rating: 0, acceptanceRate: 0 };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEarnings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEarnings.fulfilled, (state, action) => {
        state.loading = false;
        state.todayEarnings = action.payload.today;
        state.weekEarnings = action.payload.week;
        state.monthEarnings = action.payload.month;
        state.stats = action.payload.stats;
      })
      .addCase(fetchEarnings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearEarnings } = earningsSlice.actions;
export default earningsSlice.reducer;
