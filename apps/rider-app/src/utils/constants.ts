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

export const SOCKET_URL = resolveLocalhost(extra.TRACKING_URL) || (IS_PRODUCTION ? '' : resolveLocalhost(DEV_TRACKING_URL)!);

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

export const LOCATION_UPDATE_INTERVAL = 5000;
export const LOCATION_UPDATE_THROTTLE = 5000;

export const MAPMYINDIA_APP_ID = 'MAPMYINDIA_APP_ID';
export const MAPMYINDIA_APP_CODE = 'MAPMYINDIA_APP_CODE';
export const MAPMYINDIA_MAP_SDK_KEY = 'MAPMYINDIA_MAP_SDK_KEY';

export const COLORS = {
  primary: '#1E3A8A',
  primaryDark: '#1E40AF',
  secondary: '#F59E0B',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  background: '#F3F4F6',
  surface: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  disabled: '#9CA3AF',
} as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Awaiting Acceptance',
  assigned: 'Accepted',
  packed: 'Packed',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  confirmed: COLORS.warning,
  assigned: COLORS.primary,
  packed: '#F97316',
  picked_up: '#8B5CF6',
  out_for_delivery: '#EC4899',
  delivered: COLORS.success,
  cancelled: COLORS.error,
};
