import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { LOCATION_UPDATE_THROTTLE, RIDER_SERVICE_URL } from '../utils/constants';
import { storage } from './storage';

const BACKGROUND_LOCATION_TASK = 'rider-background-location';

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.log('[LocationService] Background task error:', error.message);
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.[locations.length - 1];

    if (!latest) {
      return;
    }

    try {
      const token = await storage.getToken();
      if (!token) {
        return;
      }

      await fetch(`${RIDER_SERVICE_URL}/riders/me/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
          accuracy: latest.coords.accuracy,
        }),
      });
    } catch (taskError) {
      console.log('[LocationService] Background location upload failed:', taskError);
    }
  });
}

export interface CurrentLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  altitude: number | null;
}

type LocationCallback = (location: CurrentLocation) => void;

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private lastUpdate: number = 0;
  private callbacks: Set<LocationCallback> = new Set();
  private foregroundPermissionGranted = false;

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    this.foregroundPermissionGranted = foregroundStatus === 'granted';

    if (!this.foregroundPermissionGranted) {
      return false;
    }

    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch {
      // Background permission is optional for live in-app tracking on Android.
    }

    return true;
  }

  async hasPermissions(): Promise<boolean> {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      this.foregroundPermissionGranted = foreground.status === 'granted';
      if (!this.foregroundPermissionGranted) {
        console.log('[LocationService] Foreground permission not granted:', foreground.status);
        return false;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        console.log('[LocationService] Global location services disabled');
        return false;
      }
      return true;
    } catch (error) {
      console.log('[LocationService] hasPermissions error:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<CurrentLocation | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
      };
    } catch {
      try {
        const location = await Location.getLastKnownPositionAsync();
        if (!location) {
          return null;
        }

        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
        };
      } catch {
        return null;
      }
    }
  }

  async startTracking(): Promise<boolean> {
    const hasPerms = await this.hasPermissions();
    if (!hasPerms) {
      const granted = await this.requestPermissions();
      if (!granted) return false;
    }

    if (this.locationSubscription) {
      return true;
    }

    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10,
        timeInterval: LOCATION_UPDATE_THROTTLE,
      },
      (location) => {
        const now = Date.now();
        if (now - this.lastUpdate < LOCATION_UPDATE_THROTTLE) {
          return;
        }
        this.lastUpdate = now;

        const currentLocation: CurrentLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
          speed: location.coords.speed,
          accuracy: location.coords.accuracy,
          altitude: location.coords.altitude,
        };

        this.callbacks.forEach((callback) => callback(currentLocation));
      }
    );

    return true;
  }

  async startBackgroundTracking(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    const hasPerms = await this.hasPermissions();
    if (!hasPerms) {
      const granted = await this.requestPermissions();
      if (!granted) return false;
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
        notificationColor: '#1E3A8A',
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

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export const locationService = new LocationService();
