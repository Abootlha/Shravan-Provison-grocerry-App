import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiErrorMessage, authApi, riderApi } from '../../services/api';
import { storage } from '../../services/storage';
import { ensureFreshAccessToken } from '../../services/authSession';
import type { Rider } from '../../types/rider';

interface AuthState {
  isAuthenticated: boolean;
  user: Rider | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  /** Shown on Login after the server ended the session. */
  sessionNotice: string | null;
  /** Online/offline request in flight. */
  availabilityPending: boolean;
  availabilityError: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
  sessionNotice: null,
  availabilityPending: false,
  availabilityError: null,
};

const persistSession = async (response: { token?: string; refreshToken?: string; user: Rider }) => {
  if (!response.token) throw new Error('No access token in the login response');
  await storage.setToken(response.token);
  await storage.setRefreshToken(response.refreshToken);
  await storage.setUser(response.user);
};

export const login = createAsyncThunk<
  { token: string; user: Rider },
  { username: string; password: string },
  { rejectValue: string }
>('auth/login', async ({ username, password }, { rejectWithValue }) => {
  try {
    const response = await authApi.login(username, password);
    await persistSession(response);
    return { token: response.token, user: response.user };
  } catch (error) {
    return rejectWithValue(apiErrorMessage(error, 'Login failed. Please try again.'));
  }
});

export const sendOtp = createAsyncThunk<{ otpLength?: number }, string, { rejectValue: string }>(
  'auth/sendOtp',
  async (phone, { rejectWithValue }) => {
    try {
      return await authApi.sendOtp(phone);
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, 'Could not send the OTP.'));
    }
  }
);

export const verifyOtp = createAsyncThunk<
  { token: string; user: Rider },
  { phone: string; otp: string },
  { rejectValue: string }
>('auth/verifyOtp', async ({ phone, otp }, { rejectWithValue }) => {
  try {
    const response = await authApi.verifyOtp(phone, otp);
    await persistSession(response);
    return { token: response.token, user: response.user };
  } catch (error) {
    return rejectWithValue(apiErrorMessage(error, 'OTP verification failed.'));
  }
});

export const loadUser = createAsyncThunk('auth/loadUser', async (_, { rejectWithValue }) => {
  try {
    const token = await storage.getToken();
    const refreshToken = await storage.getRefreshToken();
    const user = await storage.getUser<Rider>();
    // A refresh token alone is enough: restore now, renew the access token in
    // the background (App.tsx) instead of making the rider wait or log in.
    if (user && (token || refreshToken)) {
      return { token, user, notice: null };
    }
    return { token: null, user: null, notice: await storage.takeSessionNotice() };
  } catch {
    return rejectWithValue('Failed to load user');
  }
});

/** Server truth for profile and online status. */
export const refreshRider = createAsyncThunk<Rider, void, { rejectValue: string }>(
  'auth/refreshRider',
  async (_, { rejectWithValue }) => {
    try {
      const rider = await riderApi.getMe();
      await storage.setUser(rider);
      return rider;
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, 'Could not load your profile.'));
    }
  }
);

export const setAvailability = createAsyncThunk<Rider, boolean, { rejectValue: string }>(
  'auth/setAvailability',
  async (isOnline, { rejectWithValue }) => {
    try {
      const rider = await riderApi.updateAvailability(isOnline);
      await storage.setUser(rider);
      return rider;
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, isOnline ? 'Could not go online.' : 'Could not go offline.'));
    }
  }
);

export const saveProfile = createAsyncThunk<
  Rider,
  { name?: string; vehicleType?: string; vehicleNumber?: string },
  { rejectValue: string }
>('auth/saveProfile', async (patch, { rejectWithValue }) => {
  try {
    const rider = await riderApi.updateProfile(patch);
    await storage.setUser(rider);
    return rider;
  } catch (error) {
    return rejectWithValue(apiErrorMessage(error, 'Could not save your profile.'));
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
    // Go offline first so no new orders are reserved for a signed-out rider.
    await riderApi.updateAvailability(false).catch(() => undefined);
    // /auth/logout needs a live access token to end this device's session.
    await ensureFreshAccessToken();
    await authApi.logout();
  } catch {
    // Best effort: local tokens are cleared regardless.
  }
  await storage.clearAll();
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearAvailabilityError: (state) => {
      state.availabilityError = null;
    },
    tokenRefreshed: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
    },
    sessionExpired: (state, action: PayloadAction<string | undefined>) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.sessionNotice = action.payload ?? null;
    },
    clearSessionNotice: (state) => {
      state.sessionNotice = null;
    },
  },
  extraReducers: (builder) => {
    const signedIn = (state: AuthState, payload: { token: string; user: Rider }) => {
      state.loading = false;
      state.error = null;
      state.sessionNotice = null;
      state.isAuthenticated = true;
      state.token = payload.token;
      state.user = payload.user;
    };
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => signedIn(state, action.payload))
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Login failed.';
      })
      .addCase(sendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendOtp.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(sendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Could not send the OTP.';
      })
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => signedIn(state, action.payload))
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'OTP verification failed.';
      })
      .addCase(loadUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadUser.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload?.user) {
          state.isAuthenticated = true;
          state.token = action.payload.token;
          state.user = action.payload.user;
        } else if (action.payload?.notice) {
          state.sessionNotice = action.payload.notice;
        }
      })
      .addCase(loadUser.rejected, (state) => {
        state.loading = false;
      })
      .addCase(refreshRider.fulfilled, (state, action) => {
        if (state.isAuthenticated) state.user = action.payload;
      })
      .addCase(setAvailability.pending, (state) => {
        state.availabilityPending = true;
        state.availabilityError = null;
      })
      .addCase(setAvailability.fulfilled, (state, action) => {
        state.availabilityPending = false;
        if (state.isAuthenticated) state.user = action.payload;
      })
      .addCase(setAvailability.rejected, (state, action) => {
        state.availabilityPending = false;
        state.availabilityError = action.payload ?? 'Could not change your status.';
      })
      .addCase(saveProfile.fulfilled, (state, action) => {
        if (state.isAuthenticated) state.user = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
      });
  },
});

export const { clearError, clearAvailabilityError, tokenRefreshed, sessionExpired, clearSessionNotice } =
  authSlice.actions;
export default authSlice.reducer;
