import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Coordinates } from '../../types/order';

interface LocationState {
  currentLocation: Coordinates | null;
  isTracking: boolean;
  heading: number | null;
  speed: number | null;
  error: string | null;
}

const initialState: LocationState = {
  currentLocation: null,
  isTracking: false,
  heading: null,
  speed: null,
  error: null,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setCurrentLocation: (state, action: PayloadAction<Coordinates>) => {
      state.currentLocation = action.payload;
    },
    setTracking: (state, action: PayloadAction<boolean>) => {
      state.isTracking = action.payload;
    },
    setHeading: (state, action: PayloadAction<number | null>) => {
      state.heading = action.payload;
    },
    setSpeed: (state, action: PayloadAction<number | null>) => {
      state.speed = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearLocation: (state) => {
      state.currentLocation = null;
      state.heading = null;
      state.speed = null;
    },
  },
});

export const {
  setCurrentLocation,
  setTracking,
  setHeading,
  setSpeed,
  setError,
  clearLocation,
} = locationSlice.actions;

export default locationSlice.reducer;
