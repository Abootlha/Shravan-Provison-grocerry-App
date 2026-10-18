import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LiveLocation } from '../../types/rider';

export type LocationPermission = 'unknown' | 'granted' | 'denied' | 'services_off';

interface LocationState {
  current: LiveLocation | null;
  /** True while the foreground GPS watcher is running. */
  isTracking: boolean;
  permission: LocationPermission;
  /** Background tracking could not start (e.g. "Allow all the time" not granted). */
  backgroundWarning: string | null;
  error: string | null;
}

const initialState: LocationState = {
  current: null,
  isTracking: false,
  permission: 'unknown',
  backgroundWarning: null,
  error: null,
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    locationUpdated: (state, action: PayloadAction<LiveLocation>) => {
      state.current = action.payload;
    },
    trackingChanged: (state, action: PayloadAction<boolean>) => {
      state.isTracking = action.payload;
    },
    permissionChanged: (state, action: PayloadAction<LocationPermission>) => {
      state.permission = action.payload;
    },
    backgroundWarningChanged: (state, action: PayloadAction<string | null>) => {
      state.backgroundWarning = action.payload;
    },
    locationError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { locationUpdated, trackingChanged, permissionChanged, backgroundWarningChanged, locationError } =
  locationSlice.actions;

export default locationSlice.reducer;
