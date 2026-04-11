import Constants from 'expo-constants';

const PUBLIC_NODE_ENV = Constants.expoConfig?.extra?.PUBLIC_NODE_ENV || 'development';
const IS_PRODUCTION = PUBLIC_NODE_ENV === 'production';

const getBaseUrl = () => {
  if (IS_PRODUCTION) {
    return 'https://api.lumioui.com/api/v1';
  }

  return 'http://localhost:3000/api/v1';
};

const getSocketUrl = () => {
  if (IS_PRODUCTION) {
    return 'https://api.lumioui.com/tracking';
  }

  return 'http://localhost:3000/tracking';
};

export const AUTH_SERVICE_URL = Constants.expoConfig?.extra?.AUTH_SERVICE_URL || getBaseUrl();

export const RIDER_SERVICE_URL = Constants.expoConfig?.extra?.RIDER_SERVICE_URL || getBaseUrl();

export const ORDER_SERVICE_URL = Constants.expoConfig?.extra?.ORDER_SERVICE_URL || getBaseUrl();

export const SOCKET_URL = Constants.expoConfig?.extra?.TRACKING_URL || getSocketUrl();

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
