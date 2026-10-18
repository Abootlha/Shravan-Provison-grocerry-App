import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiErrorMessage, riderApi } from '../../services/api';
import type { RiderMetrics } from '../../types/rider';

interface MetricsState {
  data: RiderMetrics | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
}

const initialState: MetricsState = {
  data: null,
  loading: false,
  error: null,
  fetchedAt: null,
};

export const fetchMetrics = createAsyncThunk<RiderMetrics, void, { rejectValue: string }>(
  'metrics/fetch',
  async (_, { rejectWithValue }) => {
    try {
      return await riderApi.getMetrics();
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, 'Could not load your earnings.'));
    }
  }
);

const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    resetMetrics: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMetrics.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMetrics.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.data = action.payload;
        state.fetchedAt = Date.now();
      })
      .addCase(fetchMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Could not load your earnings.';
      });
  },
});

export const { resetMetrics } = metricsSlice.actions;
export default metricsSlice.reducer;
