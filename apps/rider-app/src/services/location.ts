import * as Location from 'expo-location';
import { LOCATION_UPDATE_THROTTLE } from '../utils/constants';

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

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    return backgroundStatus === 'granted';
  }

  async hasPermissions(): Promise<boolean> {
    const foreground = await Location.getForegroundPermissionsAsync();
    const background = await Location.getBackgroundPermissionsAsync();
    return foreground.status === 'granted' && background.status === 'granted';
  }

  async getCurrentLocation(): Promise<CurrentLocation | null> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
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
      return null;
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
        accuracy: Location.Accuracy.High,
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

  stopTracking(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
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
