import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useAppDispatch, useAppSelector } from './useAuth';
import { socketService } from '../services/socket';
import { locationService, toLocationPayload } from '../services/location';
import { settingsApi } from '../services/api';
import { registerRealtimeHandlers } from '../services/realtime';
import { store } from '../store';
import { refreshRider } from '../store/slices/authSlice';
import { fetchCurrentOrder, fetchOffers, offerExpired, resetOrders } from '../store/slices/orderSlice';
import { fetchMetrics, resetMetrics } from '../store/slices/metricsSlice';
import {
  backgroundWarningChanged,
  locationError,
  locationUpdated,
  permissionChanged,
  trackingChanged,
} from '../store/slices/locationSlice';
import { LOCATION_UPDATE_INTERVAL, OFFER_TIMEOUT_SECONDS } from '../utils/constants';

/** A fix older than this is not sent as the rider's live position. */
const MAX_FIX_AGE_MS = 30_000;

const useAppState = () => {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', setState);
    return () => sub.remove();
  }, []);
  return state;
};

/** Reads the current permission / GPS state into Redux. */
export const checkLocationPermission = async () => {
  if (Platform.OS === 'web') {
    store.dispatch(permissionChanged('granted'));
    return true;
  }
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      store.dispatch(permissionChanged(status === 'denied' ? 'denied' : 'unknown'));
      return false;
    }
    const enabled = await Location.hasServicesEnabledAsync();
    store.dispatch(permissionChanged(enabled ? 'granted' : 'services_off'));
    return enabled;
  } catch {
    return false;
  }
};

/**
 * App-lifetime side effects for a signed-in rider, mounted once next to the
 * navigator: socket connection, socket listeners, location tracking and the
 * upload loop, data refresh on reconnect / foreground, offer timeouts.
 * Screens never start or stop any of this themselves, so remounting a screen
 * cannot leave a stale interval or a duplicate listener behind.
 */
export const useRiderRuntime = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const token = useAppSelector((s) => s.auth.token);
  const isOnline = useAppSelector((s) => Boolean(s.auth.user?.isOnline));
  const hasActiveOrder = useAppSelector((s) => Boolean(s.orders.currentOrder));
  const offers = useAppSelector((s) => s.orders.offers);
  const offerSeenAt = useAppSelector((s) => s.orders.offerSeenAt);
  const appState = useAppState();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    registerRealtimeHandlers(store);
  }, []);

  // Socket follows the session; the token change after a refresh is applied in place.
  useEffect(() => {
    if (isAuthenticated && token) socketService.connect(token);
  }, [isAuthenticated, token]);

  // Sign in / sign out.
  useEffect(() => {
    if (isAuthenticated && !wasAuthenticated.current) {
      settingsApi.loadStore().catch(() => undefined);
      dispatch(refreshRider());
      dispatch(fetchCurrentOrder());
      dispatch(fetchOffers());
      dispatch(fetchMetrics());
      checkLocationPermission();
    }
    if (!isAuthenticated && wasAuthenticated.current) {
      socketService.disconnect();
      locationService.stopTracking();
      locationService.stopBackgroundTracking().catch(() => undefined);
      dispatch(trackingChanged(false));
      dispatch(resetOrders());
      dispatch(resetMetrics());
    }
    wasAuthenticated.current = isAuthenticated;
  }, [dispatch, isAuthenticated]);

  // Catch up on events missed while disconnected.
  useEffect(() => {
    let previous = socketService.getState();
    return socketService.onStateChange((next) => {
      if (next === 'connected' && previous !== 'connected' && store.getState().auth.isAuthenticated) {
        dispatch(fetchCurrentOrder());
        dispatch(fetchOffers());
      }
      previous = next;
    });
  }, [dispatch]);

  // Back in the foreground: refresh everything that may have changed.
  const previousAppState = useRef(appState);
  useEffect(() => {
    const was = previousAppState.current;
    previousAppState.current = appState;
    if (!isAuthenticated || appState !== 'active' || was === 'active') return;
    dispatch(refreshRider());
    dispatch(fetchCurrentOrder());
    dispatch(fetchOffers());
    dispatch(fetchMetrics());
    checkLocationPermission();
  }, [appState, dispatch, isAuthenticated]);

  // Location: on while online or carrying an order. Foreground watcher while
  // the app is visible, the OS background task while it is not.
  const shouldTrack = isAuthenticated && (isOnline || hasActiveOrder);
  const foreground = appState === 'active';
  useEffect(() => {
    let cancelled = false;
    if (!shouldTrack) {
      locationService.stopTracking();
      locationService.stopBackgroundTracking().catch(() => undefined);
      dispatch(trackingChanged(false));
      return undefined;
    }

    if (foreground) {
      locationService.stopBackgroundTracking().catch(() => undefined);
      locationService.startTracking().then((started) => {
        if (cancelled) return;
        dispatch(trackingChanged(started));
        dispatch(locationError(started ? null : locationService.lastError));
        checkLocationPermission();
        if (started) locationService.getCurrentLocation().catch(() => undefined);
      });
    } else {
      locationService.stopTracking();
      dispatch(trackingChanged(false));
      locationService
        .startBackgroundTracking()
        .then((started) => {
          if (!cancelled) dispatch(backgroundWarningChanged(started ? null : locationService.lastError));
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [dispatch, shouldTrack, foreground]);

  // Every fix goes to Redux (map, distances). One listener for the app lifetime.
  useEffect(() => locationService.subscribe((fix) => dispatch(locationUpdated(fix))), [dispatch]);

  // Upload loop. Reads the service's latest fix at send time, never a captured copy.
  useEffect(() => {
    if (!shouldTrack || !foreground) return undefined;
    const send = () => {
      const fix = locationService.latest;
      if (!fix || Date.now() - fix.timestamp > MAX_FIX_AGE_MS) return;
      socketService.emit('riderLocationUpdate', toLocationPayload(fix));
    };
    send();
    const timer = setInterval(send, LOCATION_UPDATE_INTERVAL);
    return () => clearInterval(timer);
  }, [shouldTrack, foreground]);

  // Offer countdown: when time runs out the request is only marked expired on
  // this device. No reject call, so a missed alert does not lower the rider's
  // acceptance rate; the store/admin reassigns the order.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const timers = offers.map((offer) => {
      const seen = offerSeenAt[offer.id] ?? Date.now();
      const remaining = seen + OFFER_TIMEOUT_SECONDS * 1000 - Date.now();
      return setTimeout(
        () => {
          const state = store.getState().orders;
          if (state.pendingOrderId === offer.id || state.expiredOfferIds[offer.id]) return;
          if (!state.offers.some((o) => o.id === offer.id)) return;
          dispatch(offerExpired(offer.id));
        },
        Math.max(0, remaining)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [dispatch, isAuthenticated, offers, offerSeenAt]);
};
