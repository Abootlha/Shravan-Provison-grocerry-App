import { useEffect, useRef, useState } from 'react';
import type { Coordinates } from '../types/order';
import { GOOGLE_MAPS_API_KEY } from '../utils/constants';
import { distanceKm } from '../utils/format';

export type RouteLine = {
  points: Coordinates[];
  /** 'road' follows streets; 'straight' is a direct line (no route available). */
  kind: 'road' | 'straight';
  distanceMeters?: number;
  durationSeconds?: number;
};

/** Google encoded polyline → coordinates. */
export const decodePolyline = (encoded: string): Coordinates[] => {
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
};

/** Re-request directions only after moving this far from the last origin. */
const REFETCH_KM = 0.3;

/**
 * Route for the current leg: the backend's route when it sent one, else Google
 * Directions when a key is configured, else a straight line.
 */
export const useRouteLine = (
  origin: Coordinates | null,
  destination: Coordinates | null,
  serverRoute: Coordinates[]
): RouteLine | null => {
  const [google, setGoogle] = useState<RouteLine | null>(null);
  const lastOrigin = useRef<Coordinates | null>(null);
  const lastDest = useRef<string>('');

  const destKey = destination ? `${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}` : '';

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !origin || !destination || serverRoute.length > 1) return undefined;
    const moved = distanceKm(lastOrigin.current, origin);
    if (lastDest.current === destKey && moved != null && moved < REFETCH_KM) return undefined;
    lastOrigin.current = origin;
    lastDest.current = destKey;

    const controller = new AbortController();
    const url =
      'https://maps.googleapis.com/maps/api/directions/json' +
      `?origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}` +
      `&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        const route = json?.routes?.[0];
        const encoded: string | undefined = route?.overview_polyline?.points;
        if (json?.status !== 'OK' || !encoded) {
          setGoogle(null);
          return;
        }
        const leg = route.legs?.[0];
        setGoogle({
          points: decodePolyline(encoded),
          kind: 'road',
          distanceMeters: leg?.distance?.value,
          durationSeconds: leg?.duration?.value,
        });
      })
      .catch(() => undefined);
    return () => controller.abort();
    // Coordinates change every fix; the distance check above throttles requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.latitude, origin?.longitude, destKey, serverRoute.length]);

  if (!destination) return null;
  if (serverRoute.length > 1) return { points: serverRoute, kind: 'road' };
  if (google && lastDest.current === destKey) return google;
  if (!origin) return null;
  return { points: [origin, destination], kind: 'straight' };
};
