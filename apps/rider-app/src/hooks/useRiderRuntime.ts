import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useAppDispatch, useAppSelector } from './useAuth';
import { socketService } from '../services/socket';
import { locationService, toLocationPayload } from '../services/location';
import { settingsApi } from '../services/api';
import { offerSummary, registerRealtimeHandlers } from '../services/realtime';
import { notificationService } from '../services/notifications';
import { registerPushNotifications } from '../services/pushRegistration';
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
/**
 * How often permission and GPS are re-checked while the app is open. Turning
 * location off from the quick-settings shade does not change AppState, so
 * without this the app would not notice until the next foreground.
 */
const PERMISSION_POLL_MS = 10_000;

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
    // "Allow all the time" may have been granted in Settings since the warning.
    if (enabled && store.getState().location.backgroundWarning && (await locationService.hasBackgroundPermission())) {
      store.dispatch(backgroundWarningChanged(null));
    }
    return enabled;
  } catch {
    // Keep the last known state rather than flipping the UI on a glitch.
    return store.getState().location.permission === 'granted';
  }
};

/**
 * Loads open requests and rings for any this phone has not seen yet, e.g.
 * offers made while the socket was reconnecting or the app was closed.
 */
const catchUpOffers = async (dispatch: ReturnType<typeof useAppDispatch>) => {
  const known = new Set(store.getState().orders.offers.map((offer) => offer.id));
  const result = await dispatch(fetchOffers());
  if (!fetchOffers.fulfilled.match(result)) return;
  const { expiredOfferIds } = store.getState().orders;
  for (const order of result.payload) {
    if (known.has(order.id) || expiredOfferIds[order.id]) continue;
    notificationService.alertNewOrder(order.id, order.orderNumber, offerSummary(order)).catch(() => undefined);
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
  const permission = useAppSelector((s) => s.location.permission);
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
      catchUpOffers(dispatch);
      dispatch(fetchMetrics());
      checkLocationPermission();
      registerPushNotifications();
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
        // The server may have set the rider offline while disconnected: show
        // the real status instead of a stale "Online".
        dispatch(refreshRider());
        dispatch(fetchCurrentOrder());
        catchUpOffers(dispatch);
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
    catchUpOffers(dispatch);
    dispatch(fetchMetrics());
    checkLocationPermission();
    // Notification permission may have been turned on in Settings meanwhile.
    registerPushNotifications();
  }, [appState, dispatch, isAuthenticated]);

  // Location: on while online or carrying an order. Foreground watcher while
  // the app is visible, the OS background task while it is not.
  const shouldTrack = isAuthenticated && (isOnline || hasActiveOrder);
  // iOS reports 'inactive' for Control Center, the notification shade and
  // permission alerts: the app is still on screen, so keep the foreground watcher.
  const foreground = appState !== 'background';
  // Permission or GPS lost: stop the watcher; regained: this effect restarts it.
  const locationBlocked = permission === 'denied' || permission === 'services_off';
  useEffect(() => {
    let cancelled = false;
    if (!shouldTrack) {
      locationService.stopTracking();
      locationService.stopBackgroundTracking().catch(() => undefined);
      dispatch(trackingChanged(false));
      return undefined;
    }

    if (foreground && locationBlocked) {
      locationService.stopTracking();
      dispatch(trackingChanged(false));
      dispatch(
        locationError(
          permission === 'denied'
            ? 'Location permission was denied.'
            : 'Turn on location (GPS) so the store and customers can track your trip.'
        )
      );
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
  }, [dispatch, shouldTrack, foreground, locationBlocked, permission]);

  // Live permission / GPS check while the app is open.
  useEffect(() => {
    if (!shouldTrack || !foreground) return undefined;
    const timer = setInterval(() => {
      checkLocationPermission();
    }, PERMISSION_POLL_MS);
    return () => clearInterval(timer);
  }, [shouldTrack, foreground]);

  // Every fix goes to Redux (map, distances). One listener for the app lifetime.
  useEffect(() => locationService.subscribe((fix) => dispatch(locationUpdated(fix))), [dispatch]);

  // Upload loop. Reads the service's latest fix at send time, never a captured copy.
  useEffect(() => {
    if (!shouldTrack || !foreground) return undefined;
    let refreshing = false;
    const send = () => {
      const fix = locationService.latest;
      if (fix && Date.now() - fix.timestamp <= MAX_FIX_AGE_MS) {
        socketService.emit('riderLocationUpdate', toLocationPayload(fix));
        return;
      }
      // The watcher only reports after the rider moves 5 m, so a rider
      // waiting at the store has no fresh fix. Ask for one: it keeps the map
      // right and tells the server the rider is still there (riders the
      // server stops hearing from are set offline).
      if (refreshing) return;
      refreshing = true;
      locationService
        .getCurrentLocation()
        .then((fresh) => {
          if (fresh) socketService.emit('riderLocationUpdate', toLocationPayload(fresh));
        })
        .finally(() => {
          refreshing = false;
        });
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
