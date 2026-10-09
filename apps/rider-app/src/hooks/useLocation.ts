import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from './useAuth';
import { setCurrentLocation, setTracking, setHeading, setSpeed } from '../store/slices/locationSlice';
import { locationService, CurrentLocation } from '../services/location';
import { socketService } from '../services/socket';

export const useLocation = () => {
  const dispatch = useAppDispatch();
  const { currentLocation, isTracking, heading, speed, error } = useAppSelector(
    (state) => state.location
  );
  const locationRef = useRef<CurrentLocation | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const handleLocationUpdate = useCallback(
    (location: CurrentLocation) => {
      locationRef.current = location;
      dispatch(
        setCurrentLocation({
          latitude: location.latitude,
          longitude: location.longitude,
        })
      );
      dispatch(setHeading(location.heading));
      dispatch(setSpeed(location.speed));
    },
    [dispatch]
  );

  const startTracking = useCallback(async () => {
    // locationService.startTracking checks/requests permissions and is
    // idempotent, so concurrent callers share a single watcher.
    const started = await locationService.startTracking();
    if (started) {
      dispatch(setTracking(true));
      unsubscribeRef.current?.();
      unsubscribeRef.current = locationService.subscribe(handleLocationUpdate);

      const location = await locationService.getCurrentLocation();
      if (location) {
        handleLocationUpdate(location);
      }

      return true;
    }
    return false;
  }, [dispatch, handleLocationUpdate]);

  const stopTracking = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    locationService.stopTracking();
    dispatch(setTracking(false));
  }, [dispatch]);

  const startBackgroundTracking = useCallback(async () => {
    return locationService.startBackgroundTracking();
  }, []);

  const stopBackgroundTracking = useCallback(async () => {
    await locationService.stopBackgroundTracking();
  }, []);

  const startSocketTracking = useCallback(
    (_riderId: string) => {
      socketService.startLocationUpdates(() => {
        if (locationRef.current) {
          return {
            latitude: locationRef.current.latitude,
            longitude: locationRef.current.longitude,
            heading: locationRef.current.heading ?? undefined,
            speed: locationRef.current.speed ?? undefined,
          };
        }
        return null;
      });
    },
    []
  );

  const stopSocketTracking = useCallback(() => {
    socketService.stopLocationUpdates();
  }, []);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  return {
    currentLocation,
    isTracking,
    heading,
    speed,
    error,
    startTracking,
    stopTracking,
    startBackgroundTracking,
    stopBackgroundTracking,
    startSocketTracking,
    stopSocketTracking,
    getCurrentLocation: locationService.getCurrentLocation.bind(locationService),
  };
};
