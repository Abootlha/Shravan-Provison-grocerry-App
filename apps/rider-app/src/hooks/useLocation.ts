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
    const hasPermission = await locationService.requestPermissions();
    if (!hasPermission) {
      return false;
    }

    const started = await locationService.startTracking();
    if (started) {
      dispatch(setTracking(true));
      const unsubscribe = locationService.subscribe(handleLocationUpdate);

      const location = await locationService.getCurrentLocation();
      if (location) {
        handleLocationUpdate(location);
      }

      return true;
    }
    return false;
  }, [dispatch, handleLocationUpdate]);

  const stopTracking = useCallback(() => {
    locationService.stopTracking();
    dispatch(setTracking(false));
  }, [dispatch]);

  const startSocketTracking = useCallback(
    (riderId: string) => {
      if (isTracking) {
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
      }
    },
    [isTracking]
  );

  const stopSocketTracking = useCallback(() => {
    socketService.stopLocationUpdates();
  }, []);

  useEffect(() => {
    return () => {
      locationService.stopTracking();
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
    startSocketTracking,
    stopSocketTracking,
    getCurrentLocation: locationService.getCurrentLocation.bind(locationService),
  };
};
