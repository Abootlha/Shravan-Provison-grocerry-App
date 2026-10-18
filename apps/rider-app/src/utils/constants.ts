import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const PUBLIC_NODE_ENV = extra.PUBLIC_NODE_ENV || 'development';
const IS_PRODUCTION = PUBLIC_NODE_ENV === 'production';

const DEV_API_BASE_URL = 'http://localhost:3000/api/v1';
const DEV_TRACKING_URL = 'http://localhost:3000/tracking';

// In development on a physical device, "localhost" is the phone itself. Rewrite
// it to the LAN IP of the machine running Metro (from hostUri), like the customer app.
const resolveLocalhost = (url?: string): string | undefined => {
  if (IS_PRODUCTION || !url || !url.includes('localhost')) return url;

  let host = 'localhost';
  if (Constants.expoConfig?.hostUri) {
    host = Constants.expoConfig.hostUri.split(':')[0];
  } else if (typeof window !== 'undefined' && window.location?.hostname) {
    host = window.location.hostname;
  }

  return url.replace('localhost', host);
};

const API_BASE_URL = resolveLocalhost(extra.API_BASE_URL) || (IS_PRODUCTION ? '' : resolveLocalhost(DEV_API_BASE_URL)!);

export const AUTH_SERVICE_URL = resolveLocalhost(extra.AUTH_SERVICE_URL) || API_BASE_URL;

export const RIDER_SERVICE_URL = resolveLocalhost(extra.RIDER_SERVICE_URL) || API_BASE_URL;

export const ORDER_SERVICE_URL = resolveLocalhost(extra.ORDER_SERVICE_URL) || API_BASE_URL;

export const SOCKET_URL =
  resolveLocalhost(extra.TRACKING_URL) || (IS_PRODUCTION ? '' : resolveLocalhost(DEV_TRACKING_URL)!);

if (IS_PRODUCTION) {
  const misconfigured = [AUTH_SERVICE_URL, RIDER_SERVICE_URL, ORDER_SERVICE_URL, SOCKET_URL].filter(
    (url) => !url || /localhost|127\.0\.0\.1|10\.0\.2\.2/.test(url)
  );
  if (misconfigured.length > 0) {
    const message =
      '[config] Production build resolved an empty/localhost API URL. Set API_BASE_URL and TRACKING_URL in the EAS build profile env.';
    console.error(message, { AUTH_SERVICE_URL, RIDER_SERVICE_URL, ORDER_SERVICE_URL, SOCKET_URL });
    throw new Error(message);
  }
}

/** Socket location cadence while online (the server accepts one every 2.5 s). */
export const LOCATION_UPDATE_INTERVAL = 5000;
export const LOCATION_UPDATE_THROTTLE = 5000;

/**
 * Optional key for client-side Google Directions. The backend already sends a
 * route for the active leg; this is only a fallback. Without either, the map
 * draws a straight line.
 */
export const GOOGLE_MAPS_API_KEY: string = extra.GOOGLE_MAPS_API_KEY || '';

/** Seconds a rider has to accept an order offer before it is declined for them. */
export const OFFER_TIMEOUT_SECONDS = 45;

/** Server-side OTP attempt limit (PATCH /orders/:id/status). */
export const DELIVERY_OTP_MAX_ATTEMPTS = 5;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: 'New request',
  assigned: 'Accepted',
  packed: 'Ready for pickup',
  picked_up: 'Picked up',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const REJECT_REASONS = [
  'Too far from the store',
  'Vehicle issue',
  'Already on a break',
  'Unsafe area or weather',
  'Personal emergency',
] as const;
