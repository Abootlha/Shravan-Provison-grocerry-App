import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../../services/api';
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
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
  sessionNotice: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ username, password }: any, { rejectWithValue }) => {
    try {
      const response = await authApi.login(username, password);
      await storage.setToken(response.token);
      await storage.setRefreshToken(response.refreshToken);
      await storage.setUser(response.user);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const sendOtp = createAsyncThunk(
  'auth/sendOtp',
  async (phone: string, { rejectWithValue }) => {
    try {
      return await authApi.sendOtp(phone);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to send OTP');
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async ({ phone, otp, name }: { phone: string; otp: string; name?: string }, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyOtp(phone, otp, name);
      await storage.setToken(response.token);
      await storage.setRefreshToken(response.refreshToken);
      await storage.setUser(response.user);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'OTP verification failed');
    }
  }
);

export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue }) => {
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
  }
);

export const logout = createAsyncThunk('auth/logout', async () => {
  try {
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
    setUser: (state, action: PayloadAction<Rider>) => {
      state.user = action.payload;
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
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.sessionNotice = null;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.user as Rider;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
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
        state.error = action.payload as string;
      })
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.sessionNotice = null;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.user as Rider;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
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
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
      });
  },
});

export const { clearError, setUser, tokenRefreshed, sessionExpired, clearSessionNotice } = authSlice.actions;
export default authSlice.reducer;
