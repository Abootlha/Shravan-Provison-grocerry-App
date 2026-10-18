import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { LOCATION_UPDATE_THROTTLE, RIDER_SERVICE_URL } from '../utils/constants';
import type { LiveLocation } from '../types/rider';
import { storage } from './storage';
import { ensureFreshAccessToken, refreshAccessToken } from './authSession';

const BACKGROUND_LOCATION_TASK = 'rider-background-location';

const stopBackgroundUpdatesQuietly = async (): Promise<void> => {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Nothing else to do from inside the task.
  }
};

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      if (__DEV__) console.log('[LocationService] Background task error:', error.message);
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.[locations.length - 1];

    if (!latest) {
      return;
    }

    try {
      // Renew a stale access token first. Only a 401 from /auth/refresh ends the
      // session (tokens are cleared then); offline, the stored token is kept.
      let token = await ensureFreshAccessToken();
      if (!token) {
        if (!(await storage.getRefreshToken())) {
          // Signed out, or the session really ended: stop posting locations.
          await stopBackgroundUpdatesQuietly();
        }
        return;
      }

      const body = JSON.stringify(toLocationPayload(fromExpoLocation(latest)));
      const send = (accessToken: string) =>
        fetch(`${RIDER_SERVICE_URL}/riders/me/location`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body,
        });

      const response = await send(token);
      if (response.status === 401) {
        token = await refreshAccessToken();
        if (!token) {
          if (!(await storage.getRefreshToken())) {
            await stopBackgroundUpdatesQuietly();
          }
          return;
        }
        await send(token);
      }
    } catch (taskError) {
      if (__DEV__) console.log('[LocationService] Background location upload failed:', taskError);
    }
  });
}

export type CurrentLocation = LiveLocation;

type LocationCallback = (location: CurrentLocation) => void;

/** UI refresh cadence for the rider marker; uploads are throttled separately. */
const WATCH_INTERVAL_MS = 2000;

export function fromExpoLocation(location: Location.LocationObject): LiveLocation {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    heading: location.coords.heading,
    speed: location.coords.speed,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp || Date.now(),
  };
}

/**
 * Body for PUT /riders/me/location and the riderLocationUpdate socket event.
 * Drops values the server would reject (iOS reports -1 for unknown heading/speed).
 */
export function toLocationPayload(location: LiveLocation) {
  const payload: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
  } = { latitude: location.latitude, longitude: location.longitude };
  if (location.accuracy != null && location.accuracy >= 0) payload.accuracy = location.accuracy;
  if (location.heading != null && location.heading >= 0 && location.heading <= 360) payload.heading = location.heading;
  if (location.speed != null && location.speed >= 0) payload.speed = location.speed;
  return payload;
}

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private lastUpdate: number = 0;
  private callbacks: Set<LocationCallback> = new Set();
  private foregroundPermissionGranted = false;
  private backgroundPermissionGranted = false;
  private startTrackingPromise: Promise<boolean> | null = null;
  /** Latest fix from any source. The single source of truth for "where am I". */
  latest: CurrentLocation | null = null;

  private publish(location: CurrentLocation): CurrentLocation {
    this.latest = location;
    this.callbacks.forEach((callback) => callback(location));
    return location;
  }

  isWatching(): boolean {
    return this.locationSubscription !== null;
  }
  /** Human-readable reason for the last failed start, for the UI to surface. */
  lastError: string | null = null;

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    this.foregroundPermissionGranted = foregroundStatus === 'granted';

    if (!this.foregroundPermissionGranted) {
      return false;
    }

    try {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      this.backgroundPermissionGranted = backgroundStatus === 'granted';
    } catch {
      // Background permission is optional for live in-app tracking.
      this.backgroundPermissionGranted = false;
    }

    return true;
  }

  async hasBackgroundPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      this.backgroundPermissionGranted = status === 'granted';
    } catch {
      this.backgroundPermissionGranted = false;
    }
    return this.backgroundPermissionGranted;
  }

  async hasPermissions(): Promise<boolean> {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      this.foregroundPermissionGranted = foreground.status === 'granted';
      if (!this.foregroundPermissionGranted) {
        if (__DEV__) console.log('[LocationService] Foreground permission not granted:', foreground.status);
        return false;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (__DEV__) console.log('[LocationService] Global location services disabled');
        return false;
      }
      return true;
    } catch (error) {
      if (__DEV__) console.log('[LocationService] hasPermissions error:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<CurrentLocation | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return this.publish(fromExpoLocation(location));
    } catch {
      try {
        const location = await Location.getLastKnownPositionAsync();
        if (!location) {
          return null;
        }

        return this.publish(fromExpoLocation(location));
      } catch {
        return null;
      }
    }
  }

  /**
   * Idempotent: concurrent callers share one in-flight start, and an existing
   * watcher is reused, so multiple effects can't create duplicate watchers.
   */
  startTracking(): Promise<boolean> {
    if (this.locationSubscription) {
      return Promise.resolve(true);
    }
    if (!this.startTrackingPromise) {
      this.startTrackingPromise = this.doStartTracking().finally(() => {
        this.startTrackingPromise = null;
      });
    }
    return this.startTrackingPromise;
  }

  private async doStartTracking(): Promise<boolean> {
    const hasPerms = await this.hasPermissions();
    if (!hasPerms) {
      const granted = await this.requestPermissions();
      if (!granted) {
        this.lastError = 'Location permission was denied.';
        return false;
      }
    }

    if (this.locationSubscription) {
      return true;
    }

    let subscription: Location.LocationSubscription;
    try {
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
          timeInterval: WATCH_INTERVAL_MS,
        },
        (location) => {
          const now = Date.now();
          if (now - this.lastUpdate < WATCH_INTERVAL_MS - 500) {
            return;
          }
          this.lastUpdate = now;
          this.publish(fromExpoLocation(location));
        }
      );
    } catch {
      this.lastError = 'Turn on location (GPS) to go online.';
      return false;
    }

    if (this.locationSubscription) {
      subscription.remove();
    } else {
      this.locationSubscription = subscription;
    }
    this.lastError = null;
    return true;
  }

  async startBackgroundTracking(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    const hasPerms = await this.hasPermissions();
    if (!hasPerms) {
      const granted = await this.requestPermissions();
      if (!granted) {
        this.lastError = 'Location permission was denied.';
        return false;
      }
    }

    if (!(await this.hasBackgroundPermission())) {
      // startLocationUpdatesAsync throws / is rejected by the OS without
      // "Allow all the time" (Android) or "Always" (iOS).
      this.lastError =
        'Background location is not allowed. Set location access to "Allow all the time" so deliveries keep updating while the app is in the background.';
      return false;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (alreadyStarted) {
      return true;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_UPDATE_THROTTLE,
      distanceInterval: 10,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: 'ShravanKirana Delivery Tracking',
        notificationBody: 'Sharing your live location for active deliveries.',
        notificationColor: '#6C3CF4',
      },
    });

    return true;
  }

  stopTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  async stopBackgroundTracking(): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (alreadyStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  }

  subscribe(callback: LocationCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const locationService = new LocationService();
